import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import TimelineEmptyPlaceholder from '@/components/timeline-empty-placeholder';
import { useUserFilterEffect } from '@/query/status-query-invalidation';
import { useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import { Text, TextInput } from '@/components/app-text';
import ComposerModal from '@/components/composer-modal';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import useTimelineStatusInteractions from '@/components/use-timeline-status-interactions';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import { isNativeScrollEdgeEffectAvailable } from '@/navigation/native-scroll-edge';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import type { PhotoViewerOriginRect } from '@/components/photo-viewer-shared-transition';
import TimelineStatusCard from '@/components/timeline-status-card';
import { CARD_PASTEL_CYCLE, type DropShadowBoxType } from '@/components/drop-shadow-box';
import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import {
  TIMELINE_PAGE_SIZE,
  TIMELINE_SPACING,
  useTimelineListSettings,
} from '@/components/timeline-list-settings';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';

const SEARCH_COUNT = 20;

const normalizeItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];
const getStatusId = (status: FanfouStatus): string => status.id;
const mergeItems = (existing: FanfouStatus[], incoming: FanfouStatus[]) => {
  const seen = new Set(existing.map(getStatusId));
  return [...existing, ...incoming.filter(item => !seen.has(getStatusId(item)))];
};

const SearchRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const authUserId = auth.accessToken?.userId ?? null;
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [accent, background, muted, foreground] = useThemeColor([
    'accent', 'background', 'muted', 'foreground',
  ]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isDark = useEffectiveIsDark();
  // Near-opaque iOS system-fill colors (0.92 alpha) so the search text stays
  // legible even when dark photos scroll behind the translucent header. The
  // slight translucency keeps it from looking like a hard pill floating over
  // the bar — content peeks through enough to feel connected.
  const inputBackground = isDark
    ? 'rgba(44,44,46,0.92)'
    : 'rgba(235,235,238,0.92)';

  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    return navigation.addListener('transitionEnd', () => {
      inputRef.current?.focus();
    });
  }, [navigation]);

  const [inputText, setInputText] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: foreground,
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      scrollEdgeEffects: isNativeScrollEdgeEffectAvailable
        ? { top: 'automatic' }
        : undefined,
      // eslint-disable-next-line react/no-unstable-nested-components
      headerTitle: () => (
        <View style={[styles.inputContainer, { backgroundColor: inputBackground }]}>
          <Search size={16} color={muted} strokeWidth={2} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: foreground }]}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={muted}
            onChangeText={setInputText}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />
        </View>
      ),
    });
  }, [foreground, inputBackground, isDark, muted, navigation, t]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FanfouStatus[]>([]);
  useUserFilterEffect(setResults);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerOriginRect, setPhotoViewerOriginRect] = useState<PhotoViewerOriginRect | null>(null);

  // Debounce inputText → query
  useEffect(() => {
    const trimmed = inputText.trim();
    const timer = setTimeout(() => {
      setQuery(trimmed);
      setResults([]);
      setHasReachedEnd(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [inputText]);

  const updateStatusById = (statusId: string, updater: (s: FanfouStatus) => FanfouStatus) => {
    setResults(previous => previous.map(item => item.id === statusId ? updater(item) : item));
  };
  const {
    composeMode,
    composerTitle,
    composerPlaceholder,
    composerSubmitLabel,
    composerInitialText,
    composerResetKey,
    composerQuotedStatus,
    isComposerSubmitting,
    pendingBookmarkIds,
    handleOpenReplyComposer,
    handleOpenRepostComposer,
    handleCloseComposer,
    handleSendComposer,
    handleToggleBookmark,
  } = useTimelineStatusInteractions({ updateStatusById });

  const { data: queryData, isLoading } = useQuery<FanfouStatus[]>({
    queryKey: ['search', 'statuses', query],
    queryFn: async () => {
      if (!query) return [];
      const data = await get('/search/public_timeline', {
        q: query,
        count: SEARCH_COUNT,
        mode: 'default',
      });
      return normalizeItems(data);
    },
    enabled: Boolean(query),
    retry: 1,
  });

  useEffect(() => {
    if (!queryData) return;
    setResults(queryData);
    setHasReachedEnd(false);
  }, [queryData]);

  const fetchMore = async () => {
    if (!query || isFetchingMore || isLoading || hasReachedEnd || results.length === 0) return;
    const maxId = getStatusId(results[results.length - 1]);
    setIsFetchingMore(true);
    try {
      const data = await get('/search/public_timeline', {
        q: query,
        count: TIMELINE_PAGE_SIZE,
        max_id: maxId,
        mode: 'default',
      });
      const nextItems = normalizeItems(data);
      if (nextItems.length === 0) { setHasReachedEnd(true); return; }
      setResults(prev => mergeItems(prev, nextItems));
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleDeleteStatus = (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    return deleteStatus({
      queryClient,
      statusId,
      t,
      onDeleted: () => setResults(prev => prev.filter(item => getStatusId(item) !== statusId)),
    });
  };

  const handleMentionPress = (userId: string) => {
    navigation.push(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: { userId },
    });
  };
  const handleProfilePress = (userId: string) => {
    navigation.push(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: { userId },
    });
  };
  const handleStatusPress = (statusId: string, shadowType: DropShadowBoxType) => {
    navigation.push(AUTH_STACK_ROUTE.STATUS, {
      screen: AUTH_STATUS_ROUTE.DETAIL,
      params: { statusId, shadowType },
    });
  };
  const handleTagPress = (tag: string) => {
    const normalized = tag.trim().replace(/^#+/, '').replace(/#+$/, '').trim();
    if (!normalized) return;
    navigation.push(AUTH_STACK_ROUTE.TAG_TIMELINE, {
      screen: AUTH_TAG_TIMELINE_ROUTE.DETAIL,
      params: { tag: normalized },
    });
  };
  const handlePhotoPress = (photoUrl: string, originRect?: PhotoViewerOriginRect | null) => {
    Image.prefetch(photoUrl).catch(() => undefined);
    setPhotoViewerOriginRect(originRect ?? null);
    setPhotoViewerUrl(photoUrl);
    setPhotoViewerVisible(true);
  };
  const handleClosePhotoViewer = () => {
    setPhotoViewerVisible(false);
    setPhotoViewerUrl(null);
    setPhotoViewerOriginRect(null);
  };

  const scrollHandler = useAnimatedScrollHandler({ onScroll: () => {} });
  const timelineListSettings = useTimelineListSettings(insets, { hasBottomTabBar: false });

  // On Android the transparent header doesn't auto-inset content, so we
  // push content down by headerHeight ourselves. iOS handles this via
  // contentInsetAdjustmentBehavior="automatic" on the FlatList below.
  const androidHeaderOffset = Platform.OS === 'android' ? headerHeight : 0;
  const listContentContainerStyle = {
    ...timelineListSettings.contentContainerStyle,
    paddingTop: androidHeaderOffset + (results.length > 0 ? TIMELINE_SPACING : 0),
    flexGrow: 1,
  };

  const isEmpty = !isLoading && Boolean(query) && results.length === 0;

  // KAV only on iOS. Android has windowSoftInputMode=adjustResize and handles
  // keyboard resize natively; wrapping the content in a KAV there animates the
  // container size each keyboard frame and makes the empty placeholder + bottom
  // edge flicker.
  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const keyboardWrapperProps =
    Platform.OS === 'ios' ? { behavior: 'padding' as const } : {};

  return (
    <View style={[styles.flex, { backgroundColor: background }]}>
      <KeyboardWrapper style={styles.flex} {...keyboardWrapperProps}>
      <NativeEdgeScrollShadow
        style={styles.flex}
        color={background}
        visibility={Platform.OS === 'android' ? 'top' : 'both'}
      >
        <Animated.FlatList
          style={styles.flex}
          data={results}
          keyExtractor={item => getStatusId(item)}
          onScroll={scrollHandler}
          scrollEventThrottle={timelineListSettings.scrollEventThrottle}
          scrollIndicatorInsets={timelineListSettings.scrollIndicatorInsets}
          contentContainerStyle={listContentContainerStyle}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListFooterComponent={
            isFetchingMore ? (
              <View className="items-center py-6">
                <NeobrutalActivityIndicator size="small" />
              </View>
            ) : hasReachedEnd && results.length > 0 ? (
              <View className="items-center py-6">
                <Text className="text-[12px] tracking-[4px] text-muted">FIN</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {isLoading && query ? (
                <NeobrutalActivityIndicator size="small" />
              ) : isEmpty ? (
                <TimelineEmptyPlaceholder icon={Search} message={t('searchEmpty')} />
              ) : !query ? (
                <TimelineEmptyPlaceholder icon={Search} message={t('searchHint')} />
              ) : null}
            </View>
          }
          onEndReached={fetchMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) => (
            <Animated.View style={timelineListSettings.animatedItemStyle}>
              <TimelineStatusCard
                status={item}
                accent={accent}
                muted={muted}
                shadowType={CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length]}
                isBookmarkPending={pendingBookmarkIds.has(getStatusId(item))}
                onOpenPhoto={handlePhotoPress}
                onPressStatus={handleStatusPress}
                onPressProfile={handleProfilePress}
                onPressMention={handleMentionPress}
                onPressTag={handleTagPress}
                onReply={handleOpenReplyComposer}
                onRepost={handleOpenRepostComposer}
                onToggleBookmark={handleToggleBookmark}
                canDelete={isStatusOwnedByUser(item, authUserId)}
                onDelete={handleDeleteStatus}
              />
            </Animated.View>
          )}
        />
        <PhotoViewerModal
          visible={photoViewerVisible}
          photoUrl={photoViewerUrl}
          onClose={handleClosePhotoViewer}
          originRect={photoViewerOriginRect}
        />
      </NativeEdgeScrollShadow>
      </KeyboardWrapper>

      {/* Bottom fade for Android. Pinned to root View's bottom: 0 (NOT inside
          the ScrollShadow wrapper) so it doesn't re-measure when the keyboard
          resizes the content area. The native window-resize animates the whole
          root View in one step; the gradient rides along smoothly. */}
      {Platform.OS === 'android' ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', background]}
          style={styles.bottomFade}
        />
      ) : null}

      <ComposerModal
        visible={composeMode !== null}
        title={composerTitle}
        placeholder={composerPlaceholder}
        submitLabel={composerSubmitLabel}
        initialText={composerInitialText}
        resetKey={composerResetKey}
        quotedStatus={composerQuotedStatus}
        enablePhoto={composeMode === 'reply'}
        allowEmptyText={composeMode === 'repost'}
        isSubmitting={isComposerSubmitting}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </View>
  );
};

export default SearchRoute;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginRight: 16,
  },
  searchIcon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    // Android TextInput defaults to a tall Material-style field with
    // includeFontPadding + built-in vertical padding. Strip both so the
    // pill height matches iOS and the input follows the container's
    // paddingVertical: 8 exactly.
    ...Platform.select({
      android: {
        paddingVertical: 0,
        textAlignVertical: 'center' as const,
        includeFontPadding: false,
      },
    }),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
});
