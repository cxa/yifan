import React, { useEffect, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { buildRepostStatus, executeComposerSend, toPlainText } from '@/utils/composer-send';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
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
import { Surface, Switch, useThemeColor } from 'heroui-native';
import ErrorBanner from '@/components/error-banner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/auth/auth-session';
import { get, post } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import DropShadowBox, {
  getDropShadowBorderClass,
  type DropShadowBoxType,
} from '@/components/drop-shadow-box';
import NativeEdgeScrollShadow, {
  resolveNativeEdgeScrollShadowSize,
} from '@/components/native-edge-scroll-shadow';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import type { PhotoViewerOriginRect } from '@/components/photo-viewer-shared-transition';
import ProfilePageBackdrop from '@/components/profile-page-backdrop';
import ProfileStatRow, {
  type ProfileStatItem,
} from '@/components/profile-stat-row';
import ProfileSummaryCard from '@/components/profile-summary-card';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import TimelineStatusCard from '@/components/timeline-status-card';
import { CARD_PASTEL_CYCLE } from '@/components/drop-shadow-box';
import { isHydratingTimeline } from '@/components/timeline-hydration';
import {
  getTimelineItemSeparatorStyle,
  getTimelineStatusStackStyle,
  TIMELINE_SPACING,
} from '@/components/timeline-list-settings';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import useUserTimelineHeader from '@/navigation/use-user-timeline-header';
import { useReadableContentInsets } from '@/navigation/readable-content-guide';
import type {
  AuthProfileStackParamList,
  AuthStackParamList,
} from '@/navigation/types';
import {
  profileUserQueryOptions,
  userQueryKeys,
} from '@/query/user-query-options';
import {
  useDirectMessageMutation,
  useStatusUpdateMutation,
} from '@/query/post-mutations';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import { openLink } from '@/utils/open-link';
import type { FanfouStatus, FanfouUser } from '@/types/fanfou';
import { formatJoinedAt } from '@/utils/fanfou-date';
import { parseHtmlToText } from '@/utils/parse-html';
import {
  adaptProfilePaletteForDarkMode,
  createProfileThemeStyles,
  isColorDark,
  resolveReadableTextColor,
  resolveProfilePanelShadowStyle,
  resolveProfileThemePalette,
} from '@/utils/profile-theme';
import { useTranslation } from 'react-i18next';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import {
  useAppProfileThemePreference,
  setAppProfileThemePreference,
} from '@/settings/app-profile-theme-preference';
const PROFILE_CARD_GAP = 16;
type ComposerMode = 'mention' | 'dm' | 'reply' | 'repost' | null;
type ReplyTarget = {
  statusId: string;
  userId: string;
  screenName: string;
};
type RepostTarget = {
  statusId: string;
  screenName: string;
  plainText: string;
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
  const isDark = useEffectiveIsDark();
  const followProfileTheme = useAppProfileThemePreference();
  const handleToggleFollowProfile = async (next: boolean) => {
    try {
      await setAppProfileThemePreference(next);
    } catch {
      // ignore — UI already reverted optimistically inside the store
    }
  };
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollShadowSize = resolveNativeEdgeScrollShadowSize({
    headerHeight,
  });
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const accessToken = auth.accessToken;
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const headerTitleVisible = useSharedValue(false);
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const updateShowHeaderTitle = (nextVisibility: boolean) => {
    setShowHeaderTitle(nextVisibility);
  };
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      updatePullScrollY(event.contentOffset.y);
      const shouldShowHeaderTitle =
        event.contentOffset.y >= scrollShadowSize * 0.25;
      if (shouldShowHeaderTitle !== headerTitleVisible.value) {
        headerTitleVisible.value = shouldShowHeaderTitle;
        scheduleOnRN(updateShowHeaderTitle, shouldShowHeaderTitle);
      }
    },
  });
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerOriginRect, setPhotoViewerOriginRect] = useState<PhotoViewerOriginRect | null>(null);
  const [isFollowSubmitting, setIsFollowSubmitting] = useState(false);
  const [isBlockSubmitting, setIsBlockSubmitting] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);
  const statusUpdateMutation = useStatusUpdateMutation();
  const directMessageMutation = useDirectMessageMutation();
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
  const handleStatusPress = (statusId: string, shadowType: DropShadowBoxType) => {
    navigation.navigate(AUTH_STACK_ROUTE.STATUS, {
      screen: AUTH_STATUS_ROUTE.DETAIL,
      params: {
        statusId,
        shadowType,
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
      showVariantToast(
        'success',
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
      showVariantToast(
        'danger',
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
      showVariantToast(
        'success',
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
      showVariantToast(
        'danger',
        t('operationFailed'),
        getErrorMessage(requestError, t('profileBlockFailed')),
      );
    } finally {
      setIsBlockSubmitting(false);
    }
  };
  const handleReport = () => {
    if (!user) {
      return;
    }
    Alert.alert(
      t('profileReportConfirmTitle'),
      t('profileReportConfirmMessage'),
      [
        { text: t('profileReportConfirmCancel'), style: 'cancel' },
        {
          text: t('profileReportConfirmOpen'),
          style: 'destructive',
          onPress: () => openLink(`https://fanfou.com/${user.id}`),
        },
      ],
    );
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
      showVariantToast(
        'danger',
        t('cannotReplyTitle'),
        t('replyMissingTarget'),
      );
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
    const plainText = toPlainText(status.text);
    setComposeMode('repost');
    setComposeRepostTarget({
      statusId,
      screenName,
      plainText,
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
  const handleSendComposer = ({
    text,
    photo,
  }: ComposerModalSubmitPayload) => {
    if (!user || !composeMode) return;
    const trimmedText = text.trim();
    const hasPhoto = Boolean(photo?.base64);

    // Validate — keep composer open on error
    if (composeMode === 'dm' && !trimmedText) {
      showVariantToast('danger', t('cannotSendTitle'), t('profileNeedsContent'));
      return;
    }
    if (composeMode === 'repost' && !composeRepostTarget) {
      showVariantToast('danger', t('cannotRepostTitle'), t('repostMissingTarget'));
      return;
    }
    if (composeMode === 'reply' && !composeReplyTarget) {
      showVariantToast('danger', t('cannotReplyTitle'), t('replyMissingTarget'));
      return;
    }
    if ((composeMode === 'mention' || composeMode === 'reply') && !trimmedText && !hasPhoto) {
      showVariantToast('danger', t('cannotSendTitle'), t('replyNeedsContent'));
      return;
    }

    // Build send function before closing
    let sendFn: () => Promise<unknown>;
    let failedTitle: string;
    if (composeMode === 'mention') {
      const userId = user.id;
      sendFn = () => statusUpdateMutation.mutateAsync({
        status: photo?.base64 ? trimmedText || undefined : trimmedText,
        photoBase64: photo?.base64,
        params: { in_reply_to_user_id: userId },
      });
      failedTitle = t('profileSendFailed');
    } else if (composeMode === 'reply' && composeReplyTarget) {
      const replyTarget = composeReplyTarget;
      sendFn = () => statusUpdateMutation.mutateAsync({
        status: photo?.base64 ? trimmedText || undefined : trimmedText,
        photoBase64: photo?.base64,
        params: {
          in_reply_to_status_id: replyTarget.statusId,
          in_reply_to_user_id: replyTarget.userId,
        },
      });
      failedTitle = t('replyFailedTitle');
    } else if (composeMode === 'repost' && composeRepostTarget) {
      const repostTarget = composeRepostTarget;
      sendFn = () => statusUpdateMutation.mutateAsync({
        status: buildRepostStatus(trimmedText, repostTarget.screenName, repostTarget.plainText),
        params: { repost_status_id: repostTarget.statusId },
      });
      failedTitle = t('repostFailedTitle');
    } else {
      const userId = user.id;
      sendFn = () => directMessageMutation.mutateAsync({ userId, text: trimmedText });
      failedTitle = t('profileSendFailed');
    }

    // Close composer immediately, send in background
    const successTitle =
      composeMode === 'reply' ? t('replySent') :
      composeMode === 'repost' ? t('repostSent') :
      composeMode === 'dm' ? t('dmSent') :
      t('mentionSent');
    const successBody = composeMode === 'dm' ? undefined : t('postPendingReviewMessage');
    setComposeMode(null);
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
    executeComposerSend(sendFn, failedTitle, () =>
      showVariantToast('success', successTitle, successBody),
    );
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
      showVariantToast(
        'danger',
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
      queryClient,
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
  const profileErrorMessage = error ? t('profileLoadFailed') : null;
  const profileTechnicalError = error instanceof Error ? error.message : null;
  const recentStatusesErrorMessage = recentStatusesError ? t('recentActivityEmpty') : null;
  const recentStatusesTechnicalError =
    recentStatusesError instanceof Error ? recentStatusesError.message : null;
  const profileThemePalette = (() => {
    const palette = followProfileTheme
      ? resolveProfileThemePalette(user)
      : resolveProfileThemePalette(undefined);
    return followProfileTheme && isDark
      ? adaptProfilePaletteForDarkMode(palette)
      : palette;
  })();
  const hasBackgroundImage = Boolean(profileThemePalette.backgroundImageUrl);
  const preferredHeaderTintColor =
    profileThemePalette.linkColor ?? profileThemePalette.textColor;
  const headerTintColor = hasBackgroundImage
    ? preferredHeaderTintColor ?? '#FFFFFF'
    : preferredHeaderTintColor ??
    (profileThemePalette.pageBackgroundColor
      ? resolveReadableTextColor({
        backgroundColor: profileThemePalette.pageBackgroundColor,
      })
      : undefined);
  const isHeaderTintDark = headerTintColor
    ? isColorDark(headerTintColor)
    : undefined;
  const headerBackgroundColor = hasBackgroundImage
    ? isHeaderTintDark
      ? 'rgba(255, 255, 255, 0.58)'
      : 'rgba(0, 0, 0, 0.44)'
    : undefined;
  useUserTimelineHeader({
    userId: routeUserId,
    user,
    useParentNavigation: true,
    headerTintColor,
    headerBackgroundColor,
    showHeaderTitle,
  });
  const readableInsets = useReadableContentInsets();
  const contentContainerStyle = {
    paddingHorizontal: Math.max(16, readableInsets.left),
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
        <ErrorBanner message={profileErrorMessage ?? t('profileLoadFailed')} technicalDetail={profileTechnicalError} />
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
    <Pressable
      onPress={() => handlePhotoPress(avatarUrl)}
      accessibilityRole="button"
      accessibilityLabel="Open avatar"
    >
      <View className="h-20 w-20">
        <Image
          source={{
            uri: avatarUrl,
          }}
          className="h-full w-full rounded-full bg-surface-secondary"
        />
      </View>
    </Pressable>
  ) : (
    <View className="h-20 w-20 items-center justify-center rounded-full bg-surface-secondary">
      <Text className="text-[24px] text-muted">
        {displayName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
  const profileThemeStyles = createProfileThemeStyles(profileThemePalette);
  const pageBackgroundColor =
    profileThemePalette.pageBackgroundColor ?? background;
  const profilePanelShadowStyle =
    resolveProfilePanelShadowStyle(profileThemePalette);
  const timelineAccentColor = profileThemePalette.linkColor ?? accent;
  const timelineMutedColor = profileThemePalette.mutedTextColor ?? muted;
  const statsPrimary: ProfileStatItem[] = [
    {
      label: t('profileStatPosts'),
      value: user.statuses_count,
      onPress: handleOpenTimeline,
    },
    {
      label: t(isSelf ? 'profileStatFollowing' : 'profileStatFollowingOther'),
      value: user.friends_count,
      onPress: handleOpenFollowing,
    },
    {
      label: t(isSelf ? 'profileStatFollowers' : 'profileStatFollowersOther'),
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
        <ErrorBanner message={t('notLoggedIn')} />
      </View>
    );
  }
  return (
    <>
      <ProfilePageBackdrop
        backgroundColor={pageBackgroundColor}
        backgroundImageUrl={profileThemePalette.backgroundImageUrl}
        isBackgroundImageTiled={profileThemePalette.isBackgroundImageTiled}
        isDark={isDark}
      >
        <NativeEdgeScrollShadow className="flex-1" color={pageBackgroundColor}>
          <Animated.ScrollView
            className="flex-1"
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
            <DropShadowBox
              containerClassName="mb-4"
              shadowStyle={profilePanelShadowStyle}
            >
              <ProfileSummaryCard
                avatar={profileAvatar}
                displayName={displayName}
                handleName={handleName}
                location={user.location}
                joinedAt={joinedAt}
                profileUrl={profileUrl}
                description={description}
                panelStyle={profileThemeStyles.panelStyle}
                primaryTextStyle={profileThemeStyles.primaryTextStyle}
                mutedTextStyle={profileThemeStyles.mutedTextStyle}
                linkTextStyle={profileThemeStyles.linkTextStyle}
              />
            </DropShadowBox>

            <DropShadowBox containerClassName="pb-2" shadowStyle={profilePanelShadowStyle}>
              <Surface className="bg-surface-secondary px-4 py-3" style={profileThemeStyles.panelStyle}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[14px] font-semibold text-foreground" style={profileThemeStyles.primaryTextStyle}>
                    {t('moreFollowProfile')}
                  </Text>
                  <Switch isSelected={followProfileTheme} onSelectedChange={handleToggleFollowProfile} />
                </View>
              </Surface>
            </DropShadowBox>

            <ProfileStatRow
              stats={statsPrimary}
              panelStyle={profileThemeStyles.panelStyle}
              shadowStyle={profilePanelShadowStyle}
              valueTextStyle={profileThemeStyles.primaryTextStyle}
              labelTextStyle={profileThemeStyles.primaryTextStyle}
            />
            <ProfileStatRow
              stats={statsSecondary}
              panelStyle={profileThemeStyles.panelStyle}
              shadowStyle={profilePanelShadowStyle}
              valueTextStyle={profileThemeStyles.primaryTextStyle}
              labelTextStyle={profileThemeStyles.primaryTextStyle}
            />

            {!isSelf ? (
              <DropShadowBox
                containerClassName="pb-2"
                shadowStyle={profilePanelShadowStyle}
              >
                <Surface
                  className="bg-surface-secondary px-4 py-4"
                  style={profileThemeStyles.panelStyle}
                >
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={handleFollowToggle}
                      disabled={isFollowSubmitting || isBlocked}
                      className={`flex-1 rounded-2xl border px-3 py-2 ${isBlocked ? 'bg-surface-secondary' : 'bg-accent'
                        }`}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isFollowing
                          ? t('profileActionUnfollow')
                          : t('profileActionFollow')
                      }
                    >
                      <Text
                        className={`text-[13px] text-center ${isBlocked ? 'text-muted' : 'text-accent-foreground'
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
                      className={`flex-1 rounded-2xl border px-3 py-2 ${isBlocked ? 'bg-success' : 'bg-danger'}`}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isBlocked
                          ? t('profileActionUnblock')
                          : t('profileActionBlock')
                      }
                    >
                      <Text className="text-[13px] text-center text-white">
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
                      className="flex-1 rounded-2xl border bg-surface-secondary px-3 py-2"
                      accessibilityRole="button"
                      accessibilityLabel={t('profileActionMention')}
                    >
                      <Text className="text-[13px] text-center text-foreground">
                        {t('profileActionMention')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleOpenDmComposer}
                      className="flex-1 rounded-2xl border bg-surface-secondary px-3 py-2"
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
              <ErrorBanner message={profileErrorMessage} technicalDetail={profileTechnicalError} />
            ) : null}

            {isProtectedTimeline ? (
              <DropShadowBox type="warning" containerClassName="pb-2">
                <Surface
                  className={`bg-surface-secondary ${getDropShadowBorderClass(
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
                  style={
                    profileThemeStyles.linkTextStyle ??
                    profileThemeStyles.primaryTextStyle
                  }
                >
                  {t('recentActivity')}
                </Text>
                <View style={getTimelineStatusStackStyle()}>
                  {isRecentStatusesLoading || isHydratingRecentStatuses ? (
                    <TimelineSkeletonList
                      keyPrefix="profile-status-skeleton"
                      count={3}
                      className=""
                    />
                  ) : null}

                  {recentStatusesErrorMessage ? (
                    <ErrorBanner message={recentStatusesErrorMessage} technicalDetail={recentStatusesTechnicalError} />
                  ) : null}

                  {!isRecentStatusesLoading &&
                    !isHydratingRecentStatuses &&
                    recentStatusItems.length === 0 &&
                    !recentStatusesErrorMessage ? (
                    <TimelineSkeletonCard message={t('recentActivityEmpty')} />
                  ) : null}

                  {recentStatusItems.length > 0 ? (
                    <View>
                      {recentStatusItems.map((status, index) => (
                        <React.Fragment key={getStatusId(status)}>
                          {index > 0 ? (
                            <View style={getTimelineItemSeparatorStyle()} />
                          ) : null}
                          <TimelineStatusCard
                            status={status}
                            accent={timelineAccentColor}
                            muted={timelineMutedColor}
                            shadowType={CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length]}
                            showAvatar={false}
                            showAuthor={false}
                            isBookmarkPending={pendingBookmarkIds.has(
                              getStatusId(status),
                            )}
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
                        </React.Fragment>
                      ))}
                    </View>
                  ) : null}
                </View>
              </>
            )}

            {isLoading ? (
              <View className="items-center py-3">
                <NeobrutalActivityIndicator size="small" />
              </View>
            ) : null}

            {!isSelf && user ? (
              <Pressable
                onPress={handleReport}
                className="py-6"
                accessibilityRole="button"
                accessibilityLabel={t('profileActionReport')}
              >
                <Text className="text-[13px] text-center text-muted">
                  {t('profileActionReport')}
                </Text>
              </Pressable>
            ) : null}
          </Animated.ScrollView>
          <PhotoViewerModal
            visible={photoViewerVisible}
            photoUrl={photoViewerUrl}
            onClose={handleClosePhotoViewer}
            originRect={photoViewerOriginRect}
          />
        </NativeEdgeScrollShadow>
      </ProfilePageBackdrop>
      <NeobrutalRefreshIndicator
        refreshing={isPullRefreshing}
        scrollY={pullScrollY}
        safeAreaTop={safeAreaTop}
        scrollInsetTop={scrollInsetTop}
        pullThreshold={COMPACT_PULL_THRESHOLD}
      />

      <ComposerModal
        visible={composeMode !== null}
        title={composerTitle}
        placeholder={composerPlaceholder}
        submitLabel={composerSubmitLabel}
        initialText={composerInitialText}
        resetKey={composerResetKey}
        enablePhoto={composeMode === 'mention' || composeMode === 'reply'}
        isSubmitting={
          statusUpdateMutation.isPending || directMessageMutation.isPending
        }
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
        <ErrorBanner message="Missing profile user id." />
      </View>
    );
  }
  return <ProfileRouteContent routeUserId={routeUserId} />;
};
export default ProfileRoute;
