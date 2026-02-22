import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import {
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollShadow, Surface, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { get } from '@/auth/fanfou-client';
import type { AuthStackParamList, AuthTabParamList } from '@/navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import {
  TIMELINE_HORIZONTAL_PADDING,
  useTimelineListSettings,
} from '@/components/timeline-list-settings';
import type { FanfouStatus } from '@/types/fanfou';
import { parseHtmlToSegments, parseHtmlToText } from '@/utils/parse-html';
import { formatTimestamp } from '@/utils/format-timestamp';
import { AnimatedText, Text } from '@/components/app-text';
import PhotoViewerModal from '@/components/photo-viewer-modal';

const INITIAL_PAGE_SIZE = 60;
const PAGE_SIZE = 20;
const AUTO_REFRESH_INTERVAL = 60 * 1000;
const SCROLL_TOP_THRESHOLD = 12;

type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];

const getStatusId = (status: FanfouStatus): string => status.id;

const getStatusPhotoUrl = (status: FanfouStatus): string | null => {
  const getUrl = (...candidates: Array<string | undefined>) => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
    return null;
  };
  return getUrl(
    status.photo?.largeurl,
    status.photo?.imageurl,
    status.photo?.thumburl,
  );
};

const mergeTimelineItems = (
  existing: FanfouStatus[],
  incoming: FanfouStatus[],
  position: 'prepend' | 'append',
) => {
  const seen = new Set<string>();
  const nextItems =
    position === 'prepend'
      ? [...incoming, ...existing]
      : [...existing, ...incoming];
  const merged: FanfouStatus[] = [];
  for (const item of nextItems) {
    const id = getStatusId(item);
    if (id) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
    }
    merged.push(item);
  }
  return merged;
};

const AuthHomeRoute = () => {
  const navigation = useNavigation<BottomTabNavigationProp<AuthTabParamList>>();
  const [accent, background] = useThemeColor(['accent', 'background']);
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const isAtTop = useSharedValue(true);
  const [isAtTopState, setIsAtTopState] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isFetchingLatest, setIsFetchingLatest] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timelineItems, setTimelineItems] = useState<FanfouStatus[]>([]);
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerPreviewKey, setPhotoViewerPreviewKey] = useState<
    string | null
  >(null);
  const [photoViewerOriginRect, setPhotoViewerOriginRect] =
    useState<PhotoViewerOriginRect | null>(null);
  const photoPreviewRefs = useRef(
    new Map<string, React.ComponentRef<typeof View>>(),
  );
  const listRef = useRef<FlatList<FanfouStatus>>(null);
  const latestIdRef = useRef<string | null>(null);
  const oldestIdRef = useRef<string | null>(null);
  useScrollToTop(listRef);
  const updateIsAtTop = useCallback((value: boolean) => {
    setIsAtTopState(value);
  }, []);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
      const atTop = event.contentOffset.y <= SCROLL_TOP_THRESHOLD;
      if (atTop !== isAtTop.value) {
        isAtTop.value = atTop;
        scheduleOnRN(updateIsAtTop, atTop);
      }
    },
  });
  const titleContainerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, 88],
      [44, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollY.value,
      [0, 70],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const marginBottom = interpolate(
      scrollY.value,
      [0, 88],
      [0, 0],
      Extrapolation.CLAMP,
    );

    return {
      height,
      opacity,
      marginBottom,
    };
  });
  const titleTextStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 88],
      [1, 0.6],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale }],
      transformOrigin: 'top left',
    };
  });
  const handleMentionPress = useCallback(
    (userId: string) => {
      const parentNavigation =
        navigation.getParent<NavigationProp<AuthStackParamList>>();
      if (!parentNavigation) {
        return;
      }
      parentNavigation.navigate('route_root._auth.profile', {
        screen: 'route_root._auth.profile._handle',
        params: { userId },
      });
    },
    [navigation],
  );
  const handleProfilePress = useCallback(
    (userId: string) => {
      const parentNavigation =
        navigation.getParent<NavigationProp<AuthStackParamList>>();
      if (!parentNavigation) {
        return;
      }
      parentNavigation.navigate('route_root._auth.profile', {
        screen: 'route_root._auth.profile._handle',
        params: { userId },
      });
    },
    [navigation],
  );
  const openPhotoViewer = useCallback(
    (
      photoUrl: string,
      originRect: PhotoViewerOriginRect | null,
      previewKey: string,
    ) => {
      Image.prefetch(photoUrl).catch(() => undefined);
      setPhotoViewerPreviewKey(previewKey);
      setPhotoViewerOriginRect(originRect);
      setPhotoViewerUrl(photoUrl);
      setPhotoViewerVisible(true);
    },
    [],
  );
  const registerPhotoPreviewRef = useCallback(
    (key: string, node: React.ComponentRef<typeof View> | null) => {
      if (node) {
        photoPreviewRefs.current.set(key, node);
        return;
      }
      photoPreviewRefs.current.delete(key);
    },
    [],
  );
  const handlePhotoPress = useCallback(
    (photoUrl: string, previewKey: string) => {
      const previewNode = photoPreviewRefs.current.get(previewKey);
      if (!previewNode || typeof previewNode.measureInWindow !== 'function') {
        openPhotoViewer(photoUrl, null, previewKey);
        return;
      }

      previewNode.measureInWindow((x, y, width, height) => {
        const hasValidRect =
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          width > 0 &&
          height > 0;

        openPhotoViewer(
          photoUrl,
          hasValidRect ? { x, y, width, height } : null,
          previewKey,
        );
      });
    },
    [openPhotoViewer],
  );
  const handleClosePhotoViewer = useCallback(() => {
    setPhotoViewerPreviewKey(null);
    setPhotoViewerOriginRect(null);
    setPhotoViewerVisible(false);
    setPhotoViewerUrl(null);
  }, []);
  const {
    data: initialItems = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['timeline', 'home'],
    queryFn: async () => {
      const data = await get('/statuses/home_timeline', {
        count: INITIAL_PAGE_SIZE,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    retry: 1,
  });

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load timeline.'
    : null;

  useEffect(() => {
    if (initialItems.length === 0 || timelineItems.length > 0) {
      return;
    }
    setTimelineItems(initialItems);
  }, [initialItems, timelineItems.length]);

  useEffect(() => {
    if (timelineItems.length === 0) {
      latestIdRef.current = null;
      oldestIdRef.current = null;
      return;
    }
    latestIdRef.current = getStatusId(timelineItems[0]) ?? null;
    oldestIdRef.current =
      getStatusId(timelineItems[timelineItems.length - 1]) ?? null;
  }, [timelineItems]);

  const fetchLatest = useCallback(async () => {
    if (isFetchingLatest || isLoading) {
      return;
    }
    const sinceId = latestIdRef.current;
    if (!sinceId) {
      await refetch();
      return;
    }
    setIsFetchingLatest(true);
    try {
      const data = await get('/statuses/home_timeline', {
        count: PAGE_SIZE,
        since_id: sinceId,
        mode: 'default',
      });
      const nextItems = normalizeTimelineItems(data);
      if (nextItems.length === 0) {
        return;
      }
      setTimelineItems(prev => mergeTimelineItems(prev, nextItems, 'prepend'));
    } finally {
      setIsFetchingLatest(false);
    }
  }, [isFetchingLatest, isLoading, refetch]);

  const fetchMore = useCallback(async () => {
    if (isFetchingMore || isLoading) {
      return;
    }
    const maxId = oldestIdRef.current;
    if (!maxId) {
      return;
    }
    setIsFetchingMore(true);
    try {
      const data = await get('/statuses/home_timeline', {
        count: PAGE_SIZE,
        max_id: maxId,
        mode: 'default',
      });
      const nextItems = normalizeTimelineItems(data);
      if (nextItems.length === 0) {
        return;
      }
      setTimelineItems(prev => mergeTimelineItems(prev, nextItems, 'append'));
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, isLoading]);

  useEffect(() => {
    if (!isAtTopState || isLoading) {
      return;
    }
    const interval = setInterval(() => {
      fetchLatest();
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLatest, isAtTopState, isLoading]);

  useEffect(() => {
    if (!isAtTopState || isLoading) {
      return;
    }
    fetchLatest();
  }, [fetchLatest, isAtTopState, isLoading]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      await fetchLatest();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchLatest, isRefreshing]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        tintColor={accent}
        colors={[accent]}
        progressViewOffset={Math.max(insets.top, TIMELINE_HORIZONTAL_PADDING)}
        progressBackgroundColor={background}
      />
    ),
    [accent, background, handleRefresh, insets.top, isRefreshing],
  );
  const timelineListSettings = useTimelineListSettings(insets);
  const isHydratingTimeline =
    !isLoading && timelineItems.length === 0 && initialItems.length > 0;

  return (
    <>
      <ScrollShadow
        LinearGradientComponent={LinearGradient}
        size={100}
        color={background}
      >
        <FlatList
          ref={listRef}
          data={timelineItems}
          keyExtractor={(item, index) => getStatusId(item) ?? String(index)}
          refreshControl={refreshControl}
          onScroll={scrollHandler}
          scrollEventThrottle={timelineListSettings.scrollEventThrottle}
          scrollIndicatorInsets={timelineListSettings.scrollIndicatorInsets}
          contentContainerStyle={timelineListSettings.contentContainerStyle}
          ListFooterComponent={
            isFetchingMore ? (
              <View className="items-center py-6">
                <ActivityIndicator color={accent} />
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View className="px-1 relative -bottom-2">
              <Animated.View
                className="overflow-hidden justify-end"
                style={titleContainerStyle}
              >
                <AnimatedText
                  className="text-[34px] font-bold text-foreground leading-[40px]"
                  style={titleTextStyle}
                >
                  Home
                </AnimatedText>
              </Animated.View>
              {errorMessage ? (
                <Surface className="mt-4 bg-danger-soft px-4 py-3">
                  <Text className="text-[13px] text-danger-foreground">
                    {errorMessage}
                  </Text>
                </Surface>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            isLoading || isHydratingTimeline ? (
              <View className="gap-8">
                {Array.from({ length: 6 }).map((_, index) => (
                  <TimelineSkeletonCard
                    key={`timeline-skeleton-${index}`}
                    lineCount={index % 2 === 0 ? 2 : 3}
                  />
                ))}
              </View>
            ) : (
              <TimelineSkeletonCard message="Nothing here yet." />
            )
          }
          onEndReached={fetchMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) => {
            const statusKey = getStatusId(item) ?? String(index);
            const screenName = item.user?.screen_name || '';
            const userId = item.user?.id || '';
            const handle = `@${item.user?.id || ''}`;
            const avatarUrl =
              item.user?.profile_image_url_large ||
              item.user?.profile_image_url;
            const photoUrl = getStatusPhotoUrl(item);
            const photoPreviewKey = `${statusKey}-photo`;
            const segments = parseHtmlToSegments(
              item.text || item.status || '',
            );
            const timestamp = formatTimestamp(item.created_at);
            const sourceLabel = item.source
              ? `via ${parseHtmlToText(item.source).trim()}`
              : '';

            return (
              <View className="relative">
                <View className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border -translate-x-2 translate-y-2" />
                <Pressable className="bg-surface border-2 border-foreground dark:border-border px-5 py-4 active:translate-x-[-4px] active:translate-y-[4px]">
                  <View className="flex-row gap-3">
                    {avatarUrl ? (
                      userId ? (
                        <Pressable
                          onPress={() => handleProfilePress(userId)}
                          accessibilityRole="button"
                          accessibilityLabel={`Open profile ${
                            screenName || userId
                          }`}
                        >
                          <Image
                            source={{ uri: avatarUrl }}
                            className="h-10 w-10 rounded-full bg-surface-secondary"
                          />
                        </Pressable>
                      ) : (
                        <Image
                          source={{ uri: avatarUrl }}
                          className="h-10 w-10 rounded-full bg-surface-secondary"
                        />
                      )
                    ) : (
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
                        <Text className="text-[14px] text-muted">
                          {(screenName || 'U').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View className="flex-1">
                      <View className="flex-row items-baseline gap-1.5">
                        <Text
                          className="text-[15px] font-bold text-foreground"
                          numberOfLines={1}
                        >
                          {screenName}
                        </Text>

                        <Text
                          className="text-[14px] text-muted"
                          numberOfLines={1}
                        >
                          {handle}
                        </Text>
                      </View>
                      <Text className="mt-1 text-[15px] leading-6 text-foreground">
                        {segments.length > 0
                          ? segments.map((segment, segmentIndex) => {
                              if (segment.type === 'mention') {
                                return (
                                  <Text
                                    key={`${statusKey}-${segmentIndex}`}
                                    className="text-accent"
                                    onPress={() =>
                                      handleMentionPress(segment.screenName)
                                    }
                                  >
                                    {segment.text}
                                  </Text>
                                );
                              }
                              return segment.text;
                            })
                          : ''}
                      </Text>
                      {photoUrl ? (
                        <View
                          className={
                            photoViewerVisible &&
                            photoViewerPreviewKey === photoPreviewKey
                              ? 'opacity-0'
                              : undefined
                          }
                        >
                          <Pressable
                            onPress={() =>
                              handlePhotoPress(photoUrl, photoPreviewKey)
                            }
                            className="mt-3 overflow-hidden border border-border bg-surface-secondary"
                            accessibilityRole="button"
                            accessibilityLabel="Open photo"
                          >
                            <View
                              ref={node =>
                                registerPhotoPreviewRef(photoPreviewKey, node)
                              }
                              collapsable={false}
                              className="h-[220px] w-full"
                            >
                              <Image
                                source={{ uri: photoUrl }}
                                className="h-full w-full bg-surface-secondary"
                                resizeMode="cover"
                              />
                            </View>
                          </Pressable>
                        </View>
                      ) : null}
                      {timestamp || sourceLabel ? (
                        <View className="mt-3 flex-row items-center">
                          {timestamp ? (
                            <Text className="text-[12px] text-muted">
                              {timestamp}
                            </Text>
                          ) : null}
                          {sourceLabel ? (
                            <Text
                              className="ml-2 flex-1 text-right text-[12px] text-muted"
                              numberOfLines={1}
                            >
                              {sourceLabel}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          }}
        />
      </ScrollShadow>
      <PhotoViewerModal
        visible={photoViewerVisible}
        photoUrl={photoViewerUrl}
        topInset={insets.top}
        originRect={photoViewerOriginRect}
        onClose={handleClosePhotoViewer}
      />
    </>
  );
};

export default AuthHomeRoute;
