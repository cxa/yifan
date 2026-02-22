import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { Heart, MessageCircle, Repeat2 } from 'lucide-react-native';

import { get, post, uploadPhoto } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import DropShadowBox, {
  getDropShadowBorderClass,
} from '@/components/drop-shadow-box';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import { TIMELINE_SPACING } from '@/components/timeline-list-settings';
import type {
  AuthStackParamList,
  AuthStatusScreenParamList,
} from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';
import { formatTimestamp } from '@/utils/format-timestamp';
import { openLink } from '@/utils/open-link';
import { parseHtmlToSegments, parseHtmlToText } from '@/utils/parse-html';

const STATUS_DETAIL_SECTION_GAP = 16;
const STATUS_DETAIL_CARD_GAP = 12;
const STATUS_DETAIL_TIMELINE_GROUP_GAP = 28;
const STATUS_DETAIL_TOP_PADDING = 14;
const STATUS_DETAIL_PROGRESS_OFFSET = 44;

type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ComposerMode = 'reply' | 'repost' | null;

type ReplyTarget = {
  statusId: string;
  userId: string;
  screenName: string;
};

type RepostTarget = {
  statusId: string;
  screenName: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeStatus = (value: unknown): FanfouStatus | null =>
  isRecord(value) ? (value as FanfouStatus) : null;

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

const extractErrorField = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }
  const message = value.error;
  return typeof message === 'string' && message.trim().length > 0
    ? message.trim()
    : null;
};

const parseErrorPayloadFromMessage = (message: string) => {
  const firstBraceIndex = message.indexOf('{');
  const lastBraceIndex = message.lastIndexOf('}');
  if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    return null;
  }
  const payloadText = message.slice(firstBraceIndex, lastBraceIndex + 1);
  try {
    const payload = JSON.parse(payloadText);
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const directError = extractErrorField(error);
  if (directError) {
    return directError;
  }
  if (!(error instanceof Error)) {
    return fallback;
  }
  const payload = parseErrorPayloadFromMessage(error.message);
  const payloadError = extractErrorField(payload);
  if (payloadError) {
    return payloadError;
  }
  return error.message || fallback;
};

const StatusDetailRoute = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route =
    useRoute<
      RouteProp<
        AuthStatusScreenParamList,
        'route_root._auth.status._statusId.index'
      >
    >();
  const insets = useSafeAreaInsets();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const routeStatusId = route.params.statusId.trim();

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

  const [composeMode, setComposeMode] = useState<ComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);

  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoritedOverrides, setFavoritedOverrides] = useState<
    Record<string, boolean>
  >({});

  const statusQueryKey = useMemo(
    () => ['status', 'detail', routeStatusId] as const,
    [routeStatusId],
  );
  const contextQueryKey = useMemo(
    () => ['status', 'context', routeStatusId] as const,
    [routeStatusId],
  );

  const {
    data: status,
    isLoading: isStatusLoading,
    isRefetching: isStatusRefetching,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery<FanfouStatus | null>({
    queryKey: statusQueryKey,
    queryFn: async () => {
      const data = await get('/statuses/show', {
        id: routeStatusId,
        mode: 'default',
      });
      return normalizeStatus(data);
    },
    enabled: Boolean(routeStatusId),
  });

  const {
    data: contextStatuses,
    isLoading: isContextLoading,
    isRefetching: isContextRefetching,
    error: contextError,
    refetch: refetchContext,
  } = useQuery<FanfouStatus[]>({
    queryKey: contextQueryKey,
    queryFn: async () => {
      const data = await get('/statuses/context_timeline', {
        id: routeStatusId,
        mode: 'default',
      });
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(routeStatusId),
  });

  const contextItems = useMemo(() => contextStatuses ?? [], [contextStatuses]);

  const mainStatus = useMemo(() => {
    const fromContext = contextItems.find(
      item => getStatusId(item) === routeStatusId,
    );
    return fromContext ?? status;
  }, [contextItems, routeStatusId, status]);

  const mainStatusId = mainStatus ? getStatusId(mainStatus) : routeStatusId;

  const { beforeStatuses, afterStatuses } = useMemo(() => {
    if (contextItems.length === 0) {
      return {
        beforeStatuses: [] as FanfouStatus[],
        afterStatuses: [] as FanfouStatus[],
      };
    }

    const pivotIndex = contextItems.findIndex(
      item => getStatusId(item) === mainStatusId,
    );

    if (pivotIndex === -1) {
      return {
        beforeStatuses: [] as FanfouStatus[],
        afterStatuses: [] as FanfouStatus[],
      };
    }

    return {
      beforeStatuses: contextItems.slice(0, pivotIndex),
      afterStatuses: contextItems.slice(pivotIndex + 1),
    };
  }, [contextItems, mainStatusId]);

  const statusErrorMessage = statusError
    ? getErrorMessage(statusError, 'Failed to load status.')
    : null;
  const contextErrorMessage = contextError
    ? getErrorMessage(contextError, 'Failed to load conversation.')
    : null;
  const isHydratingStatus =
    !mainStatus && (isStatusLoading || isContextLoading);
  const isPullToRefreshing = isStatusRefetching || isContextRefetching;

  const rootSafeAreaStyle = useMemo(
    () => ({
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }),
    [insets.left, insets.right, insets.top],
  );

  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: STATUS_DETAIL_TOP_PADDING,
      paddingBottom: insets.bottom + TIMELINE_SPACING,
      gap: STATUS_DETAIL_SECTION_GAP,
    }),
    [insets.bottom],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchStatus(), refetchContext()]);
  }, [refetchContext, refetchStatus]);

  const handleMentionPress = useCallback(
    (userId: string) => {
      navigation.navigate('route_root._auth.profile', {
        screen: 'route_root._auth.profile._handle',
        params: { userId },
      });
    },
    [navigation],
  );

  const handleProfilePress = useCallback(
    (userId: string) => {
      navigation.navigate('route_root._auth.profile', {
        screen: 'route_root._auth.profile._handle',
        params: { userId },
      });
    },
    [navigation],
  );

  const handleOpenStatusDetail = useCallback(
    (statusId: string) => {
      if (statusId === routeStatusId) {
        return;
      }
      navigation.navigate('route_root._auth.status', {
        screen: 'route_root._auth.status._statusId',
        params: { statusId },
      });
    },
    [navigation, routeStatusId],
  );

  const handleTagPress = useCallback(
    (tag: string) => {
      const normalizedTag = tag.trim().replace(/^#+/, '').replace(/#+$/, '');
      if (!normalizedTag) {
        return;
      }
      navigation.navigate('route_root._auth.tag', {
        screen: 'route_root._auth.tag._tag',
        params: { tag: normalizedTag },
      });
    },
    [navigation],
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

  const setBookmarkPending = useCallback(
    (statusId: string, pending: boolean) => {
      setPendingBookmarkIds(previous => {
        const next = new Set(previous);
        if (pending) {
          next.add(statusId);
        } else {
          next.delete(statusId);
        }
        return next;
      });
    },
    [],
  );

  const getIsFavorited = useCallback(
    (statusItem: FanfouStatus) => {
      const override = favoritedOverrides[getStatusId(statusItem)];
      return override ?? statusItem.favorited;
    },
    [favoritedOverrides],
  );

  const handleToggleBookmark = useCallback(
    async (statusItem: FanfouStatus) => {
      const statusId = getStatusId(statusItem);
      if (pendingBookmarkIds.has(statusId)) {
        return;
      }

      const currentFavorited = getIsFavorited(statusItem);
      const nextFavorited = !currentFavorited;

      setBookmarkPending(statusId, true);
      setFavoritedOverrides(previous => ({
        ...previous,
        [statusId]: nextFavorited,
      }));

      try {
        await post(nextFavorited ? '/favorites/create' : '/favorites/destroy', {
          id: statusId,
        });
      } catch (requestError) {
        setFavoritedOverrides(previous => ({
          ...previous,
          [statusId]: currentFavorited,
        }));
        Alert.alert(
          'Bookmark failed',
          getErrorMessage(requestError, 'Please try again.'),
        );
      } finally {
        setBookmarkPending(statusId, false);
      }
    },
    [getIsFavorited, pendingBookmarkIds, setBookmarkPending],
  );

  const handleOpenReplyComposer = useCallback((statusItem: FanfouStatus) => {
    const statusId = getStatusId(statusItem);
    const userId = statusItem.user.id.trim();
    const screenName = statusItem.user.screen_name.trim();
    if (!userId || !screenName) {
      Alert.alert('Cannot reply', 'Missing reply target.');
      return;
    }

    setComposeMode('reply');
    setComposeReplyTarget({ statusId, userId, screenName });
    setComposeRepostTarget(null);
  }, []);

  const handleOpenRepostComposer = useCallback((statusItem: FanfouStatus) => {
    const statusId = getStatusId(statusItem);
    const screenName = statusItem.user.screen_name.trim();
    setComposeMode('repost');
    setComposeRepostTarget({ statusId, screenName });
    setComposeReplyTarget(null);
  }, []);

  const handleCloseComposer = useCallback(() => {
    setComposeMode(null);
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  }, []);

  const handleSendComposer = useCallback(
    async ({ text, photo }: ComposerModalSubmitPayload) => {
      if (!composeMode) {
        return;
      }

      const trimmedText = text.trim();
      const hasPhoto = Boolean(photo?.base64);

      if (composeMode === 'reply') {
        if (!composeReplyTarget) {
          Alert.alert('Cannot reply', 'Missing reply target.');
          return;
        }
        if (!trimmedText && !hasPhoto) {
          Alert.alert('Cannot reply', 'Please enter text or attach a photo.');
          return;
        }
      }

      if (composeMode === 'repost' && !composeRepostTarget) {
        Alert.alert('Cannot repost', 'Missing repost target.');
        return;
      }

      try {
        if (composeMode === 'reply' && composeReplyTarget) {
          if (photo?.base64) {
            await uploadPhoto({
              photoBase64: photo.base64,
              status: trimmedText || undefined,
              params: {
                in_reply_to_status_id: composeReplyTarget.statusId,
                in_reply_to_user_id: composeReplyTarget.userId,
              },
            });
          } else {
            await post('/statuses/update', {
              status: trimmedText,
              in_reply_to_status_id: composeReplyTarget.statusId,
              in_reply_to_user_id: composeReplyTarget.userId,
            });
          }
        }

        if (composeMode === 'repost' && composeRepostTarget) {
          await post('/statuses/update', {
            status: trimmedText || undefined,
            repost_status_id: composeRepostTarget.statusId,
          });
        }

        setComposeMode(null);
        setComposeReplyTarget(null);
        setComposeRepostTarget(null);
        Alert.alert(
          'Sent',
          composeMode === 'reply' ? 'Reply posted.' : 'Reposted.',
        );
      } catch (requestError) {
        Alert.alert(
          composeMode === 'reply' ? 'Reply failed' : 'Repost failed',
          getErrorMessage(requestError, 'Please try again.'),
        );
      }
    },
    [composeMode, composeReplyTarget, composeRepostTarget],
  );

  const renderStatusCard = useCallback(
    (statusItem: FanfouStatus, isMainStatus: boolean) => {
      const statusId = getStatusId(statusItem);
      const screenName = statusItem.user.screen_name;
      const userId = statusItem.user.id;
      const handle = `@${userId}`;
      const avatarUrl = statusItem.user.profile_image_url;
      const photoUrl = getStatusPhotoUrl(statusItem);
      const photoPreviewKey = `${statusId}-${
        isMainStatus ? 'main' : 'context'
      }-photo`;
      const segments = parseHtmlToSegments(
        statusItem.text || statusItem.status,
      );
      const timestamp = formatTimestamp(statusItem.created_at);
      const sourceClient = parseHtmlToText(statusItem.source).trim();
      const viaLabel = sourceClient ? `via ${sourceClient}` : '';
      const isBookmarkPending = pendingBookmarkIds.has(statusId);
      const isFavorited = getIsFavorited(statusItem);

      return (
        <DropShadowBox
          key={`${statusId}-${isMainStatus ? 'main' : 'context'}`}
          type={isMainStatus ? 'accent' : 'default'}
        >
          <Pressable
            onPress={
              isMainStatus ? undefined : () => handleOpenStatusDetail(statusId)
            }
            disabled={isMainStatus}
            className={`border-2 px-5 py-4 ${
              isMainStatus
                ? `bg-surface ${getDropShadowBorderClass('accent')}`
                : `bg-surface ${getDropShadowBorderClass(
                    'default',
                  )} active:translate-x-[-4px] active:translate-y-[4px]`
            }`}
          >
            <View className="flex-row gap-3">
              {avatarUrl ? (
                <Pressable
                  onPress={event => {
                    event.stopPropagation();
                    handleProfilePress(userId);
                  }}
                  className="h-10 w-10"
                  accessibilityRole="button"
                  accessibilityLabel={`Open profile ${screenName || userId}`}
                >
                  <Image
                    source={{ uri: avatarUrl }}
                    className="h-10 w-10 rounded-full bg-surface-secondary"
                  />
                </Pressable>
              ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
                  <Text className="text-[14px] text-muted">
                    {(screenName || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}

              <View className="flex-1">
                <Text
                  className="text-[17px] font-bold text-foreground"
                  numberOfLines={1}
                >
                  {screenName}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-2">
                  <Text
                    className="min-w-0 flex-1 text-[14px] text-muted"
                    numberOfLines={1}
                  >
                    {handle}
                  </Text>
                  <Text
                    className="shrink-0 text-[12px] text-muted"
                    numberOfLines={1}
                  >
                    {timestamp}
                  </Text>
                </View>
                <Text className="mt-1 text-[15px] leading-6 text-foreground">
                  {segments.length > 0
                    ? segments.map((segment, segmentIndex) => {
                        if (segment.type === 'mention') {
                          return (
                            <Text
                              key={`${statusId}-${segmentIndex}`}
                              className="text-accent"
                              onPress={event => {
                                event.stopPropagation();
                                handleMentionPress(segment.screenName);
                              }}
                            >
                              {segment.text}
                            </Text>
                          );
                        }
                        if (segment.type === 'tag') {
                          return (
                            <Text
                              key={`${statusId}-${segmentIndex}`}
                              className="bg-accent/15 text-accent px-2 py-0.5 rounded-full"
                              onPress={event => {
                                event.stopPropagation();
                                handleTagPress(segment.tag);
                              }}
                            >
                              {segment.text}
                            </Text>
                          );
                        }
                        if (segment.type === 'link') {
                          return (
                            <Text
                              key={`${statusId}-${segmentIndex}`}
                              className="text-accent underline"
                              onPress={event => {
                                event.stopPropagation();
                                openLink(segment.href);
                              }}
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
                <View className="mt-3 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <Pressable
                      onPress={() => handleOpenReplyComposer(statusItem)}
                      className="p-1"
                      accessibilityRole="button"
                      accessibilityLabel="Reply"
                    >
                      <MessageCircle size={16} color={muted} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleOpenRepostComposer(statusItem)}
                      className="p-1"
                      accessibilityRole="button"
                      accessibilityLabel="Repost"
                    >
                      <Repeat2 size={16} color={muted} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleToggleBookmark(statusItem)}
                      disabled={isBookmarkPending}
                      className={`p-1 ${isBookmarkPending ? 'opacity-50' : ''}`}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isFavorited ? 'Remove bookmark' : 'Bookmark'
                      }
                    >
                      <Heart size={16} color={isFavorited ? accent : muted} />
                    </Pressable>
                  </View>
                  {viaLabel ? (
                    <Text
                      className="ml-3 flex-1 text-right text-[12px] text-muted"
                      numberOfLines={1}
                    >
                      {viaLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Pressable>
        </DropShadowBox>
      );
    },
    [
      accent,
      getIsFavorited,
      handleMentionPress,
      handleOpenReplyComposer,
      handleOpenRepostComposer,
      handleOpenStatusDetail,
      handleTagPress,
      handlePhotoPress,
      handleProfilePress,
      handleToggleBookmark,
      muted,
      pendingBookmarkIds,
      photoViewerPreviewKey,
      photoViewerVisible,
      registerPhotoPreviewRef,
    ],
  );

  const composerTitle =
    composeMode === 'reply'
      ? composeReplyTarget
        ? `Reply @${composeReplyTarget.screenName}`
        : 'Reply'
      : composeRepostTarget?.screenName
      ? `Repost @${composeRepostTarget.screenName}`
      : 'Repost';
  const composerPlaceholder =
    composeMode === 'reply'
      ? 'Write your reply...'
      : 'Add a comment (optional)...';
  const composerSubmitLabel = composeMode === 'reply' ? 'Reply' : 'Repost';
  const composerInitialText =
    composeMode === 'reply' && composeReplyTarget
      ? `@${composeReplyTarget.screenName} `
      : '';
  const composerResetKey =
    composeMode === 'reply'
      ? `reply:${composeReplyTarget?.statusId ?? ''}`
      : composeMode === 'repost'
      ? `repost:${composeRepostTarget?.statusId ?? ''}`
      : 'closed';

  if (!routeStatusId) {
    return (
      <View className="flex-1 bg-background" style={rootSafeAreaStyle}>
        <View className="px-5 pt-3 pb-3 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="border border-border px-3 py-2 bg-surface"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text className="text-[12px] text-foreground">Back</Text>
          </Pressable>
          <View className="flex-1 items-center px-4">
            <Text className="text-[14px] text-foreground" numberOfLines={1}>
              Status
            </Text>
          </View>
          <View className="w-[58px]" />
        </View>

        <View className="px-4">
          <Surface className="bg-danger-soft px-4 py-3">
            <Text className="text-[13px] text-danger-foreground">
              Missing status id.
            </Text>
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <>
      <View className="flex-1 bg-background" style={rootSafeAreaStyle}>
        <View className="px-5 pt-3 pb-3 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="border border-border px-3 py-2 bg-surface"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text className="text-[12px] text-foreground">Back</Text>
          </Pressable>
          <View className="flex-1 items-center px-4">
            <Text className="text-[14px] text-foreground" numberOfLines={1}>
              Status
            </Text>
          </View>
          <View className="w-[58px]" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={contentContainerStyle}
          refreshControl={
            <RefreshControl
              refreshing={isPullToRefreshing}
              onRefresh={handleRefresh}
              tintColor={accent}
              colors={[accent]}
              progressViewOffset={Math.max(
                STATUS_DETAIL_PROGRESS_OFFSET,
                insets.top,
              )}
              progressBackgroundColor={background}
            />
          }
        >
          {isHydratingStatus ? (
            <View style={{ gap: STATUS_DETAIL_CARD_GAP }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <TimelineSkeletonCard
                  key={`status-detail-skeleton-${index}`}
                  lineCount={index % 2 === 0 ? 2 : 3}
                />
              ))}
            </View>
          ) : null}

          {!mainStatus && !isStatusLoading && !isContextLoading ? (
            <DropShadowBox type="danger" containerClassName="pb-2">
              <Surface
                className={`bg-surface border-2 ${getDropShadowBorderClass(
                  'danger',
                )} px-4 py-3`}
              >
                <Text className="text-[13px] text-danger">
                  {statusErrorMessage ?? 'Failed to load status.'}
                </Text>
              </Surface>
            </DropShadowBox>
          ) : null}

          {mainStatus ? (
            <View style={{ gap: STATUS_DETAIL_TIMELINE_GROUP_GAP }}>
              {beforeStatuses.length > 0 ? (
                <View style={{ gap: STATUS_DETAIL_CARD_GAP }}>
                  <Text className="text-[12px] uppercase text-muted tracking-[1px]">
                    Earlier
                  </Text>
                  {beforeStatuses.map(item => renderStatusCard(item, false))}
                </View>
              ) : null}

              <View style={{ gap: STATUS_DETAIL_CARD_GAP }}>
                {renderStatusCard(mainStatus, true)}
              </View>

              {afterStatuses.length > 0 ? (
                <View style={{ gap: STATUS_DETAIL_CARD_GAP }}>
                  <Text className="text-[12px] uppercase text-muted tracking-[1px]">
                    Later
                  </Text>
                  {afterStatuses.map(item => renderStatusCard(item, false))}
                </View>
              ) : null}
            </View>
          ) : null}

          {contextErrorMessage && mainStatus ? (
            <Surface className="bg-danger-soft px-4 py-3">
              <Text className="text-[13px] text-danger-foreground">
                {contextErrorMessage}
              </Text>
            </Surface>
          ) : null}

          {isContextLoading && mainStatus ? (
            <View className="items-center py-3 flex-row justify-center gap-2">
              <ActivityIndicator color={accent} />
              <Text className="text-[12px] text-muted">
                Loading conversation...
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <PhotoViewerModal
        visible={photoViewerVisible}
        photoUrl={photoViewerUrl}
        topInset={insets.top}
        originRect={photoViewerOriginRect}
        onClose={handleClosePhotoViewer}
      />

      <ComposerModal
        visible={composeMode !== null}
        title={composerTitle}
        placeholder={composerPlaceholder}
        submitLabel={composerSubmitLabel}
        topInset={insets.top}
        initialText={composerInitialText}
        resetKey={composerResetKey}
        enablePhoto={composeMode === 'reply'}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};

export default StatusDetailRoute;
