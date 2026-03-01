import React, { useEffect, useRef, useState } from 'react';
import { showToastAlert } from '@/utils/toast-alert';
import { Image, Platform, Pressable, RefreshControl, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import NeobrutalActivityIndicator, {
  COMPACT_PULL_THRESHOLD,
  NeobrutalRefreshIndicator,
} from '@/components/neobrutal-activity-indicator';
import {
  usePullScrollY,
  usePullRefreshState,
} from '@/components/use-pull-to-refresh';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/auth/auth-session';
import { get, post, uploadPhoto } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import DropShadowBox, {
  getDropShadowBorderClass,
} from '@/components/drop-shadow-box';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import { getTabBarOccludedHeight } from '@/navigation/tab-bar-layout';
import ProfileStatRow, {
  type ProfileStatItem,
} from '@/components/profile-stat-row';
import ProfileSummaryCard from '@/components/profile-summary-card';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import TimelineStatusCard from '@/components/timeline-status-card';
import { isHydratingTimeline } from '@/components/timeline-hydration';
import { TIMELINE_SPACING } from '@/components/timeline-list-settings';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import useUserTimelineHeader from '@/navigation/use-user-timeline-header';
import type {
  AuthProfileStackParamList,
  AuthStackParamList,
} from '@/navigation/types';
import {
  profileUserQueryOptions,
  userQueryKeys,
} from '@/query/user-query-options';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import type { FanfouStatus, FanfouUser } from '@/types/fanfou';
import { formatJoinedAt } from '@/utils/fanfou-date';
import { parseHtmlToText } from '@/utils/parse-html';
import { useTranslation } from 'react-i18next';
const PROFILE_CARD_GAP = 16;
type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ComposerMode = 'mention' | 'dm' | 'reply' | 'repost' | null;
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
const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];
const getStatusId = (status: FanfouStatus): string => status.id;
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const normalizeUserId = (value?: string) => value?.trim();
const getRecentStatusesByUserId = async (userId: string): Promise<unknown> => {
  return get('/statuses/user_timeline', {
    id: userId,
    count: 3,
    mode: 'default',
  });
};
type ProfileRouteContentProps = {
  routeUserId: string;
};
const ProfileRouteContent = ({ routeUserId }: ProfileRouteContentProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const accessToken = auth.accessToken;
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      updatePullScrollY(event.contentOffset.y);
    },
  });
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
  const [isFollowSubmitting, setIsFollowSubmitting] = useState(false);
  const [isBlockSubmitting, setIsBlockSubmitting] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);
  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const userQueryKey = userQueryKeys.profile(routeUserId);
  const blockQueryKey = ['profile', 'block', routeUserId] as const;
  const {
    data: user,
    isLoading,
    error,
    refetch: refetchUser,
  } = useQuery({
    ...profileUserQueryOptions(routeUserId),
    enabled: Boolean(accessToken),
  });
  const authUserId = accessToken?.userId ?? '';
  const normalizedAuthScreenName = accessToken?.screenName.toLowerCase() ?? '';
  const normalizedRouteUserId = routeUserId.toLowerCase();
  const currentUserId = user ? user.id : null;
  const currentUserScreenName = user ? user.screen_name : null;
  const normalizedCurrentUserScreenName = currentUserScreenName
    ? currentUserScreenName.toLowerCase()
    : null;
  const isSelf =
    (Boolean(currentUserId) && currentUserId === authUserId) ||
    (Boolean(normalizedCurrentUserScreenName) &&
      normalizedCurrentUserScreenName === normalizedAuthScreenName) ||
    normalizedRouteUserId === normalizedAuthScreenName;
  const {
    data: isBlocked = false,
    isLoading: isBlockChecking,
    refetch: refetchBlock,
  } = useQuery<boolean>({
    queryKey: blockQueryKey,
    queryFn: async () => {
      if (!currentUserId) {
        return false;
      }
      try {
        const data = await get('/blocks/exists', {
          id: currentUserId,
        });
        if (isRecord(data) && typeof data.error === 'string') {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    },
    enabled: Boolean(accessToken) && Boolean(currentUserId) && !isSelf,
    retry: 0,
  });
  const isProtectedTimeline = Boolean(
    user && user.protected && !isSelf && user.following !== true,
  );
  const recentStatusesQueryKey = [
    'profile',
    'recent-statuses',
    routeUserId,
    currentUserId,
  ] as const;
  const {
    data: recentStatuses,
    isLoading: isRecentStatusesLoading,
    error: recentStatusesError,
    refetch: refetchRecentStatuses,
  } = useQuery<FanfouStatus[]>({
    queryKey: recentStatusesQueryKey,
    queryFn: async () => {
      const targetUserId = currentUserId || routeUserId;
      const data = await getRecentStatusesByUserId(targetUserId);
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(accessToken) && Boolean(user) && !isProtectedTimeline,
  });
  const [recentStatusItems, setRecentStatusItems] = useState<FanfouStatus[]>(
    [],
  );
  useEffect(() => {
    if (!recentStatuses) {
      return;
    }
    setRecentStatusItems(recentStatuses);
  }, [recentStatuses]);
  const isFollowing = user ? user.following === true : false;
  const updateUserCache = (patch: Partial<FanfouUser>) => {
    queryClient.setQueryData<FanfouUser | null>(userQueryKey, previous =>
      previous
        ? {
            ...previous,
            ...patch,
          }
        : previous,
    );
  };
  const updateBlockCache = (next: boolean) => {
    queryClient.setQueryData<boolean>(blockQueryKey, next);
  };
  const handleMentionPress = (targetUserId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId: targetUserId,
      },
    });
  };
  const handleStatusPress = (statusId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.STATUS, {
      screen: AUTH_STATUS_ROUTE.DETAIL,
      params: {
        statusId,
      },
    });
  };
  const handleTagPress = (tag: string) => {
    const normalizedTag = tag.trim().replace(/^#+/, '').replace(/#+$/, '');
    if (!normalizedTag) {
      return;
    }
    navigation.navigate(AUTH_STACK_ROUTE.TAG_TIMELINE, {
      screen: AUTH_TAG_TIMELINE_ROUTE.DETAIL,
      params: {
        tag: normalizedTag,
      },
    });
  };
  const statsTargetUserId = currentUserId || routeUserId;
  const handleOpenTimeline = () => {
    navigation.navigate(AUTH_STACK_ROUTE.MY_TIMELINE, {
      userId: statsTargetUserId,
      backCount: user?.statuses_count,
    });
  };
  const handleOpenFollowing = () => {
    navigation.navigate(AUTH_STACK_ROUTE.USER_LIST, {
      userId: statsTargetUserId,
      mode: 'following',
      backCount: user?.friends_count,
    });
  };
  const handleOpenFollowers = () => {
    navigation.navigate(AUTH_STACK_ROUTE.USER_LIST, {
      userId: statsTargetUserId,
      mode: 'followers',
      backCount: user?.followers_count,
    });
  };
  const handleOpenFavorites = () => {
    navigation.navigate(AUTH_STACK_ROUTE.FAVORITES, {
      userId: statsTargetUserId,
      backCount: user?.favourites_count,
    });
  };
  const handleOpenPhotos = () => {
    navigation.navigate(AUTH_STACK_ROUTE.PHOTOS, {
      userId: statsTargetUserId,
      backCount: user?.photo_count,
    });
  };
  const registerPhotoPreviewRef = (
    key: string,
    node: React.ComponentRef<typeof View> | null,
  ) => {
    if (node) {
      photoPreviewRefs.current.set(key, node);
      return;
    }
    photoPreviewRefs.current.delete(key);
  };
  const openPhotoViewer = (
    photoUrl: string,
    originRect: PhotoViewerOriginRect | null,
    previewKey: string,
  ) => {
    Image.prefetch(photoUrl).catch(() => undefined);
    setPhotoViewerPreviewKey(previewKey);
    setPhotoViewerOriginRect(originRect);
    setPhotoViewerUrl(photoUrl);
    setPhotoViewerVisible(true);
  };
  const handlePhotoPress = (photoUrl: string, previewKey: string) => {
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
        hasValidRect
          ? {
              x,
              y,
              width,
              height,
            }
          : null,
        previewKey,
      );
    });
  };
  const handleClosePhotoViewer = () => {
    setPhotoViewerPreviewKey(null);
    setPhotoViewerOriginRect(null);
    setPhotoViewerVisible(false);
    setPhotoViewerUrl(null);
  };
  const handleRefresh = async () => {
    await Promise.all([refetchUser(), refetchRecentStatuses(), refetchBlock()]);
  };
  const { isPullRefreshing, handlePullRefresh } =
    usePullRefreshState(handleRefresh);
  const handleFollowToggle = async () => {
    if (!user || isFollowSubmitting || isBlocked) {
      return;
    }
    setIsFollowSubmitting(true);
    const nextFollowing = !isFollowing;
    try {
      await post(
        nextFollowing ? '/friendships/create' : '/friendships/destroy',
        {
          id: user.id,
        },
      );
      updateUserCache({
        following: nextFollowing,
      });
      const name = user.screen_name ?? user.name ?? '';
      showToastAlert(
        t('successTitle'),
        nextFollowing
          ? t('profileFollowSuccess', {
              name,
            })
          : t('profileUnfollowSuccess', {
              name,
            }),
      );
    } catch (requestError) {
      showToastAlert(
        t('operationFailed'),
        getErrorMessage(requestError, t('profileFollowFailed')),
      );
    } finally {
      setIsFollowSubmitting(false);
    }
  };
  const handleBlockToggle = async () => {
    if (!user || isBlockSubmitting) {
      return;
    }
    setIsBlockSubmitting(true);
    const nextBlocked = !isBlocked;
    try {
      await post(nextBlocked ? '/blocks/create' : '/blocks/destroy', {
        id: user.id,
      });
      updateBlockCache(nextBlocked);
      if (nextBlocked) {
        updateUserCache({
          following: false,
        });
      }
      const name = user.screen_name ?? user.name ?? '';
      showToastAlert(
        t('successTitle'),
        nextBlocked
          ? t('profileBlockSuccess', {
              name,
            })
          : t('profileUnblockSuccess', {
              name,
            }),
      );
    } catch (requestError) {
      showToastAlert(
        t('operationFailed'),
        getErrorMessage(requestError, t('profileBlockFailed')),
      );
    } finally {
      setIsBlockSubmitting(false);
    }
  };
  const setBookmarkPending = (statusId: string, pending: boolean) => {
    setPendingBookmarkIds(previous => {
      const next = new Set(previous);
      if (pending) {
        next.add(statusId);
      } else {
        next.delete(statusId);
      }
      return next;
    });
  };
  const handleOpenReplyComposer = (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const userId = status.user.id.trim();
    const screenName = status.user.screen_name.trim();
    if (!userId || !screenName) {
      showToastAlert(t('cannotReplyTitle'), t('replyMissingTarget'));
      return;
    }
    setComposeMode('reply');
    setComposeReplyTarget({
      statusId,
      userId,
      screenName,
    });
    setComposeRepostTarget(null);
  };
  const handleOpenRepostComposer = (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const screenName = status.user.screen_name.trim();
    setComposeMode('repost');
    setComposeRepostTarget({
      statusId,
      screenName,
    });
    setComposeReplyTarget(null);
  };
  const handleOpenMentionComposer = () => {
    setComposeMode('mention');
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  };
  const handleOpenDmComposer = () => {
    setComposeMode('dm');
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  };
  const handleCloseComposer = () => {
    setComposeMode(null);
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  };
  const handleSendComposer = async ({
    text,
    photo,
  }: ComposerModalSubmitPayload) => {
    if (!user || !composeMode) {
      return;
    }
    const trimmedText = text.trim();
    const hasPhoto = Boolean(photo?.base64);
    if (composeMode === 'dm' && !trimmedText) {
      showToastAlert(t('cannotSendTitle'), t('profileNeedsContent'));
      return;
    }
    if (composeMode === 'repost' && !composeRepostTarget) {
      showToastAlert(t('cannotRepostTitle'), t('repostMissingTarget'));
      return;
    }
    if (composeMode === 'reply' && !composeReplyTarget) {
      showToastAlert(t('cannotReplyTitle'), t('replyMissingTarget'));
      return;
    }
    if (
      (composeMode === 'mention' || composeMode === 'reply') &&
      !trimmedText &&
      !hasPhoto
    ) {
      showToastAlert(t('cannotSendTitle'), t('replyNeedsContent'));
      return;
    }
    try {
      if (composeMode === 'mention') {
        if (photo?.base64) {
          await uploadPhoto({
            photoBase64: photo.base64,
            status: trimmedText || undefined,
            params: {
              in_reply_to_user_id: user.id,
            },
          });
        } else {
          await post('/statuses/update', {
            status: trimmedText,
            in_reply_to_user_id: user.id,
          });
        }
      } else if (composeMode === 'reply' && composeReplyTarget) {
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
      } else if (composeMode === 'repost' && composeRepostTarget) {
        await post('/statuses/update', {
          status: trimmedText || undefined,
          repost_status_id: composeRepostTarget.statusId,
        });
      } else {
        await post('/direct_messages/new', {
          user: user.id,
          text: trimmedText,
        });
      }
      setComposeMode(null);
      setComposeReplyTarget(null);
      setComposeRepostTarget(null);
      showToastAlert(
        t('sentTitle'),
        composeMode === 'mention'
          ? t('profileMentionSent')
          : composeMode === 'dm'
          ? t('profileMessageSent')
          : composeMode === 'reply'
          ? t('replySent')
          : t('repostSent'),
      );
    } catch (requestError) {
      showToastAlert(
        composeMode === 'repost'
          ? t('repostFailedTitle')
          : composeMode === 'reply'
          ? t('replyFailedTitle')
          : t('profileSendFailed'),
        getErrorMessage(requestError, t('profileSendFailedMessage')),
      );
    }
  };
  const handleToggleBookmark = async (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    if (pendingBookmarkIds.has(statusId)) {
      return;
    }
    const nextFavorited = !status.favorited;
    setBookmarkPending(statusId, true);
    setRecentStatusItems(previous =>
      previous.map(item =>
        getStatusId(item) === statusId
          ? {
              ...item,
              favorited: nextFavorited,
            }
          : item,
      ),
    );
    try {
      await post(nextFavorited ? '/favorites/create' : '/favorites/destroy', {
        id: statusId,
      });
      queryClient.setQueryData<FanfouStatus[]>(
        recentStatusesQueryKey,
        previous =>
          previous
            ? previous.map(item =>
                getStatusId(item) === statusId
                  ? {
                      ...item,
                      favorited: nextFavorited,
                    }
                  : item,
              )
            : previous,
      );
    } catch (requestError) {
      setRecentStatusItems(previous =>
        previous.map(item =>
          getStatusId(item) === statusId
            ? {
                ...item,
                favorited: !nextFavorited,
              }
            : item,
        ),
      );
      showToastAlert(
        t('bookmarkFailedTitle'),
        getErrorMessage(requestError, t('retryMessage')),
      );
    } finally {
      setBookmarkPending(statusId, false);
    }
  };
  const handleDeleteStatus = (status: FanfouStatus) => {
    const statusId = getStatusId(status);
    return deleteStatus({
      statusId,
      t,
      onDeleted: () => {
        setRecentStatusItems(previous =>
          previous.filter(item => getStatusId(item) !== statusId),
        );
        queryClient.setQueryData<FanfouStatus[]>(
          recentStatusesQueryKey,
          previous =>
            previous
              ? previous.filter(item => getStatusId(item) !== statusId)
              : previous,
        );
      },
    });
  };
  const profileErrorMessage = error
    ? getErrorMessage(error, t('profileLoadFailed'))
    : null;
  const recentStatusesErrorMessage = recentStatusesError
    ? getErrorMessage(recentStatusesError, t('recentActivityEmpty'))
    : null;
  useUserTimelineHeader({
    userId: routeUserId,
    user,
    useParentNavigation: true,
  });
  const contentContainerStyle = {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? headerHeight : 0,
    paddingBottom: insets.bottom + TIMELINE_SPACING,
    gap: PROFILE_CARD_GAP,
  };
  if (isLoading && !user) {
    return (
      <View className="flex-1 bg-background">
        <Animated.ScrollView
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentContainerStyle}
          scrollEnabled={false}
        >
          <DropShadowBox containerClassName="mb-4">
            <ProfileSummaryCard
              avatar={
                <View className="h-20 w-20 rounded-full bg-surface-secondary" />
              }
              displayName=""
              skeleton
            />
          </DropShadowBox>
          <ProfileStatRow stats={[]} skeleton itemCount={3} />
          <ProfileStatRow stats={[]} skeleton itemCount={2} />
        </Animated.ScrollView>
      </View>
    );
  }
  if (!user) {
    return (
      <View className="flex-1 bg-background px-4 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            {profileErrorMessage ?? t('profileLoadFailed')}
          </Text>
        </Surface>
      </View>
    );
  }
  const displayName = user.screen_name;
  const handleName = `@${user.id}`;
  const description = parseHtmlToText(user.description);
  const joinedAt = formatJoinedAt(user.created_at);
  const profileUrl = parseHtmlToText(user.url);
  const avatarUrl = user.profile_image_url_large;
  const hasAvatar = avatarUrl.trim().length > 0;
  const profileAvatar = hasAvatar ? (
    <View
      className={
        photoViewerVisible && photoViewerPreviewKey === 'profile-avatar'
          ? 'opacity-0'
          : undefined
      }
    >
      <Pressable
        onPress={() => handlePhotoPress(avatarUrl, 'profile-avatar')}
        accessibilityRole="button"
        accessibilityLabel="Open avatar"
      >
        <View
          ref={node => registerPhotoPreviewRef('profile-avatar', node)}
          collapsable={false}
          className="h-20 w-20"
        >
          <Image
            source={{
              uri: avatarUrl,
            }}
            className="h-full w-full rounded-full bg-surface-secondary"
          />
        </View>
      </Pressable>
    </View>
  ) : (
    <View className="h-20 w-20 items-center justify-center rounded-full bg-surface-secondary">
      <Text className="text-[24px] text-muted">
        {displayName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
  const statsPrimary: ProfileStatItem[] = [
    {
      label: t('profileStatPosts'),
      value: user.statuses_count,
      onPress: handleOpenTimeline,
    },
    {
      label: t('profileStatFollowing'),
      value: user.friends_count,
      onPress: handleOpenFollowing,
    },
    {
      label: t('profileStatFollowers'),
      value: user.followers_count,
      onPress: handleOpenFollowers,
    },
  ];
  const statsSecondary: ProfileStatItem[] = [
    {
      label: t('profileStatFavorites'),
      value: user.favourites_count,
      onPress: handleOpenFavorites,
    },
    {
      label: t('profileStatPhotos'),
      value: user.photo_count,
      onPress: handleOpenPhotos,
    },
  ];
  const composerTitle =
    composeMode === 'dm'
      ? t('profileMessageComposerTitle', {
          handle: handleName,
        })
      : composeMode === 'reply'
      ? composeReplyTarget
        ? t('composerReplyTo', {
            name: composeReplyTarget.screenName,
          })
        : t('composerReply')
      : composeMode === 'repost'
      ? composeRepostTarget?.screenName
        ? t('composerRepostTo', {
            name: composeRepostTarget.screenName,
          })
        : t('composerRepost')
      : t('profileMentionComposerTitle', {
          handle: handleName,
        });
  const composerPlaceholder =
    composeMode === 'dm'
      ? t('profileMessagePlaceholder')
      : composeMode === 'reply'
      ? t('composerReplyPlaceholder')
      : composeMode === 'repost'
      ? t('composerCommentPlaceholder')
      : t('composerReplyPlaceholder');
  const composerSubmitLabel =
    composeMode === 'dm'
      ? t('messageSend')
      : composeMode === 'reply'
      ? t('composerSubmitReply')
      : composeMode === 'repost'
      ? t('composerSubmitRepost')
      : t('composerSubmitPost');
  const composerInitialText =
    composeMode === 'mention'
      ? `@${user.screen_name} `
      : composeMode === 'reply' && composeReplyTarget
      ? `@${composeReplyTarget.screenName} `
      : '';
  const composerResetKey =
    composeMode === 'mention'
      ? `mention:${user.id}`
      : composeMode === 'dm'
      ? `dm:${user.id}`
      : composeMode === 'reply'
      ? `reply:${composeReplyTarget?.statusId ?? ''}`
      : composeMode === 'repost'
      ? `repost:${composeRepostTarget?.statusId ?? ''}`
      : 'closed';
  const isHydratingRecentStatuses = isHydratingTimeline({
    isLoading: isRecentStatusesLoading,
    renderedItems: recentStatusItems,
    sourceItems: recentStatuses,
  });
  if (!accessToken) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            {t('notLoggedIn')}
          </Text>
        </Surface>
      </View>
    );
  }
  return (
    <>
      <NativeEdgeScrollShadow
        className="flex-1 bg-background"
        color={background}
      >
        <Animated.ScrollView
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentContainerStyle}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handlePullRefresh}
              tintColor="transparent"
              colors={['transparent']}
            />
          }
        >
          <DropShadowBox containerClassName="mb-4">
            <ProfileSummaryCard
              avatar={profileAvatar}
              displayName={displayName}
              handleName={handleName}
              location={user.location}
              joinedAt={joinedAt}
              profileUrl={profileUrl}
              description={description}
            />
          </DropShadowBox>

          <ProfileStatRow stats={statsPrimary} />
          <ProfileStatRow stats={statsSecondary} />

          {!isSelf ? (
            <DropShadowBox containerClassName="pb-2">
              <Surface className="bg-surface-secondary border-2 border-foreground dark:border-border px-4 py-4">
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={handleFollowToggle}
                    disabled={isFollowSubmitting || isBlocked}
                    className={`flex-1 border border-border px-3 py-2 ${
                      isBlocked ? 'bg-surface' : 'bg-accent'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFollowing
                        ? t('profileActionUnfollow')
                        : t('profileActionFollow')
                    }
                  >
                    <Text
                      className={`text-[13px] text-center ${
                        isBlocked ? 'text-muted' : 'text-accent-foreground'
                      }`}
                    >
                      {isFollowSubmitting
                        ? t('profileActionUpdating')
                        : isBlocked
                        ? t('profileActionBlock')
                        : isFollowing
                        ? t('profileActionUnfollow')
                        : t('profileActionFollow')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleBlockToggle}
                    disabled={isBlockSubmitting || isBlockChecking}
                    className="flex-1 border border-border bg-surface px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={
                      isBlocked
                        ? t('profileActionUnblock')
                        : t('profileActionBlock')
                    }
                  >
                    <Text className="text-[13px] text-center text-foreground">
                      {isBlockChecking
                        ? t('profileActionChecking')
                        : isBlockSubmitting
                        ? t('profileActionUpdating')
                        : isBlocked
                        ? t('profileActionUnblock')
                        : t('profileActionBlock')}
                    </Text>
                  </Pressable>
                </View>

                <View className="mt-3 flex-row gap-3">
                  <Pressable
                    onPress={handleOpenMentionComposer}
                    className="flex-1 border border-border bg-surface px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={t('profileActionMention')}
                  >
                    <Text className="text-[13px] text-center text-foreground">
                      {t('profileActionMention')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleOpenDmComposer}
                    className="flex-1 border border-border bg-surface px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={t('profileActionMessage')}
                  >
                    <Text className="text-[13px] text-center text-foreground">
                      {t('profileActionMessage')}
                    </Text>
                  </Pressable>
                </View>
              </Surface>
            </DropShadowBox>
          ) : null}

          {profileErrorMessage ? (
            <Surface className="bg-danger-soft px-4 py-3">
              <Text className="text-[13px] text-danger-foreground">
                {profileErrorMessage}
              </Text>
            </Surface>
          ) : null}

          {isProtectedTimeline ? (
            <DropShadowBox type="warning" containerClassName="pb-2">
              <Surface
                className={`bg-surface border-2 ${getDropShadowBorderClass(
                  'warning',
                )} px-4 py-4`}
              >
                <Text className="text-[14px] leading-6 text-warning">
                  {t('protectedAccountNotice')}
                </Text>
              </Surface>
            </DropShadowBox>
          ) : (
            <>
              <Text
                className="mt-4 text-[24px] font-semibold text-foreground"
                dynamicTypeRamp="title1"
              >
                {t('recentActivity')}
              </Text>
              <View
                style={{
                  gap: TIMELINE_SPACING,
                }}
              >
                {isRecentStatusesLoading || isHydratingRecentStatuses ? (
                  <TimelineSkeletonList
                    keyPrefix="profile-status-skeleton"
                    count={3}
                    className=""
                    style={{
                      gap: TIMELINE_SPACING,
                    }}
                  />
                ) : null}

                {recentStatusesErrorMessage ? (
                  <Surface className="bg-danger-soft px-4 py-3">
                    <Text className="text-[13px] text-danger-foreground">
                      {recentStatusesErrorMessage}
                    </Text>
                  </Surface>
                ) : null}

                {!isRecentStatusesLoading &&
                !isHydratingRecentStatuses &&
                recentStatusItems.length === 0 &&
                !recentStatusesErrorMessage ? (
                  <TimelineSkeletonCard message={t('recentActivityEmpty')} />
                ) : null}

                {recentStatusItems.map(status => (
                  <TimelineStatusCard
                    key={getStatusId(status)}
                    status={status}
                    accent={accent}
                    muted={muted}
                    showAvatar={false}
                    showAuthor={false}
                    isBookmarkPending={pendingBookmarkIds.has(
                      getStatusId(status),
                    )}
                    photoViewerVisible={photoViewerVisible}
                    photoViewerPreviewKey={photoViewerPreviewKey}
                    registerPhotoPreviewRef={registerPhotoPreviewRef}
                    onOpenPhoto={handlePhotoPress}
                    onPressStatus={handleStatusPress}
                    onPressProfile={handleMentionPress}
                    onPressMention={handleMentionPress}
                    onPressTag={handleTagPress}
                    onReply={handleOpenReplyComposer}
                    onRepost={handleOpenRepostComposer}
                    onToggleBookmark={handleToggleBookmark}
                    canDelete={isStatusOwnedByUser(status, authUserId)}
                    onDelete={handleDeleteStatus}
                  />
                ))}
              </View>
            </>
          )}

          {isLoading ? (
            <View className="items-center py-3">
              <NeobrutalActivityIndicator size="small" />
            </View>
          ) : null}
        </Animated.ScrollView>
      </NativeEdgeScrollShadow>
      <NeobrutalRefreshIndicator
        refreshing={isPullRefreshing}
        scrollY={pullScrollY}
        safeAreaTop={safeAreaTop}
        scrollInsetTop={scrollInsetTop}
        pullThreshold={COMPACT_PULL_THRESHOLD}
      />

      <PhotoViewerModal
        visible={photoViewerVisible}
        photoUrl={photoViewerUrl}
        topInset={insets.top}
        bottomOccludedHeight={getTabBarOccludedHeight(insets.bottom)}
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
        enablePhoto={composeMode === 'mention' || composeMode === 'reply'}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};
const ProfileRoute = () => {
  const route =
    useRoute<
      RouteProp<AuthProfileStackParamList, typeof AUTH_PROFILE_ROUTE.DETAIL>
    >();
  const routeUserId = normalizeUserId(route.params?.userId);
  if (!routeUserId) {
    return (
      <View className="flex-1 bg-background px-4 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            Missing profile user id.
          </Text>
        </Surface>
      </View>
    );
  }
  return <ProfileRouteContent routeUserId={routeUserId} />;
};
export default ProfileRoute;
