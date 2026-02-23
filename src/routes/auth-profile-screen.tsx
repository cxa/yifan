import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import type { FanfouStatus, FanfouUser } from '@/types/fanfou';
import { formatJoinedAt } from '@/utils/fanfou-date';
import { parseHtmlToText } from '@/utils/parse-html';

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

const getUserById = async (userId: string): Promise<unknown> => {
  return get('/users/show', { id: userId });
};

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
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);

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

  const userQueryKey = useMemo(
    () => ['profile', 'user', routeUserId] as const,
    [routeUserId],
  );
  const blockQueryKey = useMemo(
    () => ['profile', 'block', routeUserId] as const,
    [routeUserId],
  );

  const {
    data: user,
    isLoading,
    isRefetching,
    error,
    refetch: refetchUser,
  } = useQuery<FanfouUser | null>({
    queryKey: userQueryKey,
    queryFn: async () => {
      const data = await getUserById(routeUserId);
      return data as FanfouUser;
    },
  });

  const accessToken = auth.accessToken as NonNullable<typeof auth.accessToken>;
  const authUserId = accessToken.userId;
  const normalizedAuthScreenName = accessToken.screenName.toLowerCase();
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
        const data = await get('/blocks/exists', { id: currentUserId });
        if (isRecord(data) && typeof data.error === 'string') {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    },
    enabled: Boolean(currentUserId) && !isSelf,
    retry: 0,
  });

  const isProtectedTimeline = Boolean(
    user && user.protected && !isSelf && user.following !== true,
  );

  const recentStatusesQueryKey = useMemo(
    () => ['profile', 'recent-statuses', routeUserId, currentUserId] as const,
    [currentUserId, routeUserId],
  );

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
    enabled: Boolean(user) && !isProtectedTimeline,
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

  const updateUserCache = useCallback(
    (patch: Partial<FanfouUser>) => {
      queryClient.setQueryData<FanfouUser | null>(userQueryKey, previous =>
        previous ? { ...previous, ...patch } : previous,
      );
    },
    [queryClient, userQueryKey],
  );

  const updateBlockCache = useCallback(
    (next: boolean) => {
      queryClient.setQueryData<boolean>(blockQueryKey, next);
    },
    [blockQueryKey, queryClient],
  );

  const handleMentionPress = useCallback(
    (targetUserId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
        screen: AUTH_PROFILE_ROUTE.DETAIL,
        params: { userId: targetUserId },
      });
    },
    [navigation],
  );

  const handleStatusPress = useCallback(
    (statusId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.STATUS, {
        screen: AUTH_STATUS_ROUTE.DETAIL,
        params: { statusId },
      });
    },
    [navigation],
  );

  const handleTagPress = useCallback(
    (tag: string) => {
      const normalizedTag = tag.trim().replace(/^#+/, '').replace(/#+$/, '');
      if (!normalizedTag) {
        return;
      }
      navigation.navigate(AUTH_STACK_ROUTE.TAG_TIMELINE, {
        screen: AUTH_TAG_TIMELINE_ROUTE.DETAIL,
        params: { tag: normalizedTag },
      });
    },
    [navigation],
  );

  const statsTargetUserId = currentUserId || routeUserId;

  const handleOpenTimeline = useCallback(() => {
    navigation.navigate(AUTH_STACK_ROUTE.MY_TIMELINE, {
      userId: statsTargetUserId,
      backCount: user?.statuses_count,
    });
  }, [navigation, statsTargetUserId, user?.statuses_count]);

  const handleOpenFollowing = useCallback(() => {
    navigation.navigate(AUTH_STACK_ROUTE.USER_LIST, {
      userId: statsTargetUserId,
      mode: 'following',
      backCount: user?.friends_count,
    });
  }, [navigation, statsTargetUserId, user?.friends_count]);

  const handleOpenFollowers = useCallback(() => {
    navigation.navigate(AUTH_STACK_ROUTE.USER_LIST, {
      userId: statsTargetUserId,
      mode: 'followers',
      backCount: user?.followers_count,
    });
  }, [navigation, statsTargetUserId, user?.followers_count]);

  const handleOpenFavorites = useCallback(() => {
    navigation.navigate(AUTH_STACK_ROUTE.FAVORITES, {
      userId: statsTargetUserId,
      backCount: user?.favourites_count,
    });
  }, [navigation, statsTargetUserId, user?.favourites_count]);

  const handleOpenPhotos = useCallback(() => {
    navigation.navigate(AUTH_STACK_ROUTE.PHOTOS, {
      userId: statsTargetUserId,
      backCount: user?.photo_count,
    });
  }, [navigation, statsTargetUserId, user?.photo_count]);

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

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchUser(), refetchRecentStatuses(), refetchBlock()]);
  }, [refetchBlock, refetchRecentStatuses, refetchUser]);

  const handleFollowToggle = useCallback(async () => {
    if (!user || isFollowSubmitting || isBlocked) {
      return;
    }

    setIsFollowSubmitting(true);
    const nextFollowing = !isFollowing;

    try {
      await post(
        nextFollowing ? '/friendships/create' : '/friendships/destroy',
        { id: user.id },
      );
      updateUserCache({ following: nextFollowing });
      Alert.alert(
        'Done',
        nextFollowing
          ? `Now following @${user.screen_name ?? user.name ?? ''}`
          : `Stopped following @${user.screen_name ?? user.name ?? ''}`,
      );
    } catch (requestError) {
      Alert.alert(
        'Request failed',
        getErrorMessage(requestError, 'Unable to update following status.'),
      );
    } finally {
      setIsFollowSubmitting(false);
    }
  }, [isBlocked, isFollowSubmitting, isFollowing, updateUserCache, user]);

  const handleBlockToggle = useCallback(async () => {
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
        updateUserCache({ following: false });
      }
      Alert.alert(
        'Done',
        nextBlocked
          ? `Blocked @${user.screen_name ?? user.name ?? ''}`
          : `Unblocked @${user.screen_name ?? user.name ?? ''}`,
      );
    } catch (requestError) {
      Alert.alert(
        'Request failed',
        getErrorMessage(requestError, 'Unable to update block status.'),
      );
    } finally {
      setIsBlockSubmitting(false);
    }
  }, [isBlockSubmitting, isBlocked, updateBlockCache, updateUserCache, user]);

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

  const handleOpenReplyComposer = useCallback((status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const userId = status.user.id.trim();
    const screenName = status.user.screen_name.trim();
    if (!userId || !screenName) {
      Alert.alert('Cannot reply', 'Missing reply target.');
      return;
    }

    setComposeMode('reply');
    setComposeReplyTarget({ statusId, userId, screenName });
    setComposeRepostTarget(null);
  }, []);

  const handleOpenRepostComposer = useCallback((status: FanfouStatus) => {
    const statusId = getStatusId(status);
    const screenName = status.user.screen_name.trim();
    setComposeMode('repost');
    setComposeRepostTarget({ statusId, screenName });
    setComposeReplyTarget(null);
  }, []);

  const handleOpenMentionComposer = useCallback(() => {
    setComposeMode('mention');
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  }, []);

  const handleOpenDmComposer = useCallback(() => {
    setComposeMode('dm');
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  }, []);

  const handleCloseComposer = useCallback(() => {
    setComposeMode(null);
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
  }, []);

  const handleSendComposer = useCallback(
    async ({ text, photo }: ComposerModalSubmitPayload) => {
      if (!user || !composeMode) {
        return;
      }

      const trimmedText = text.trim();
      const hasPhoto = Boolean(photo?.base64);
      if (composeMode === 'dm' && !trimmedText) {
        Alert.alert('Cannot send', 'Please enter text first.');
        return;
      }

      if (composeMode === 'repost' && !composeRepostTarget) {
        Alert.alert('Cannot repost', 'Missing repost target.');
        return;
      }

      if (composeMode === 'reply' && !composeReplyTarget) {
        Alert.alert('Cannot reply', 'Missing reply target.');
        return;
      }

      if (
        (composeMode === 'mention' || composeMode === 'reply') &&
        !trimmedText &&
        !hasPhoto
      ) {
        Alert.alert('Cannot send', 'Please enter text or attach a photo.');
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
        Alert.alert(
          'Sent',
          composeMode === 'mention'
            ? 'Mention posted.'
            : composeMode === 'dm'
            ? 'Direct message sent.'
            : composeMode === 'reply'
            ? 'Reply posted.'
            : 'Reposted.',
        );
      } catch (requestError) {
        Alert.alert(
          composeMode === 'repost'
            ? 'Repost failed'
            : composeMode === 'reply'
            ? 'Reply failed'
            : 'Send failed',
          getErrorMessage(requestError, 'Unable to send message.'),
        );
      }
    },
    [composeMode, composeReplyTarget, composeRepostTarget, user],
  );

  const handleToggleBookmark = useCallback(
    async (status: FanfouStatus) => {
      const statusId = getStatusId(status);
      if (pendingBookmarkIds.has(statusId)) {
        return;
      }

      const nextFavorited = !status.favorited;
      setBookmarkPending(statusId, true);
      setRecentStatusItems(previous =>
        previous.map(item =>
          getStatusId(item) === statusId
            ? { ...item, favorited: nextFavorited }
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
                    ? { ...item, favorited: nextFavorited }
                    : item,
                )
              : previous,
        );
      } catch (requestError) {
        setRecentStatusItems(previous =>
          previous.map(item =>
            getStatusId(item) === statusId
              ? { ...item, favorited: !nextFavorited }
              : item,
          ),
        );
        Alert.alert(
          'Bookmark failed',
          getErrorMessage(requestError, 'Please try again.'),
        );
      } finally {
        setBookmarkPending(statusId, false);
      }
    },
    [
      pendingBookmarkIds,
      queryClient,
      recentStatusesQueryKey,
      setBookmarkPending,
    ],
  );

  const profileErrorMessage = error
    ? getErrorMessage(error, 'Failed to load profile.')
    : null;

  const recentStatusesErrorMessage = recentStatusesError
    ? getErrorMessage(recentStatusesError, 'Failed to load recent posts.')
    : null;
  useUserTimelineHeader({
    userId: routeUserId,
    user,
    useParentNavigation: true,
  });

  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: insets.bottom + TIMELINE_SPACING,
      gap: PROFILE_CARD_GAP,
    }),
    [insets.bottom],
  );

  if (isLoading && !user) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={accent} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-background px-4 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            {profileErrorMessage ?? 'Failed to load profile.'}
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
            source={{ uri: avatarUrl }}
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
      label: 'Posts',
      value: user.statuses_count,
      onPress: handleOpenTimeline,
    },
    {
      label: 'Following',
      value: user.friends_count,
      onPress: handleOpenFollowing,
    },
    {
      label: 'Followers',
      value: user.followers_count,
      onPress: handleOpenFollowers,
    },
  ];

  const statsSecondary: ProfileStatItem[] = [
    {
      label: 'Favorites',
      value: user.favourites_count,
      onPress: handleOpenFavorites,
    },
    {
      label: 'Photos',
      value: user.photo_count,
      onPress: handleOpenPhotos,
    },
  ];

  const composerTitle =
    composeMode === 'dm'
      ? `Message ${handleName}`
      : composeMode === 'reply'
      ? composeReplyTarget
        ? `Reply @${composeReplyTarget.screenName}`
        : 'Reply'
      : composeMode === 'repost'
      ? composeRepostTarget?.screenName
        ? `Repost @${composeRepostTarget.screenName}`
        : 'Repost'
      : `Mention ${handleName}`;
  const composerPlaceholder =
    composeMode === 'dm'
      ? 'Write a private message...'
      : composeMode === 'reply'
      ? 'Write your reply...'
      : composeMode === 'repost'
      ? 'Add a comment (optional)...'
      : 'Write your mention...';
  const composerSubmitLabel =
    composeMode === 'dm'
      ? 'Send'
      : composeMode === 'reply'
      ? 'Reply'
      : composeMode === 'repost'
      ? 'Repost'
      : 'Post';
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

  return (
    <>
      <NativeEdgeScrollShadow
        className="flex-1 bg-background"
        color={background}
      >
        <ScrollView
          className="flex-1 bg-background"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentContainerStyle}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={accent}
              colors={[accent]}
              progressViewOffset={Math.max(44, insets.top)}
              progressBackgroundColor={background}
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
                      isFollowing ? 'Unfollow user' : 'Follow user'
                    }
                  >
                    <Text
                      className={`text-[13px] text-center ${
                        isBlocked ? 'text-muted' : 'text-accent-foreground'
                      }`}
                    >
                      {isFollowSubmitting
                        ? 'Updating...'
                        : isBlocked
                        ? 'Blocked'
                        : isFollowing
                        ? 'Unfollow'
                        : 'Follow'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleBlockToggle}
                    disabled={isBlockSubmitting || isBlockChecking}
                    className="flex-1 border border-border bg-surface px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={
                      isBlocked ? 'Unblock user' : 'Block user'
                    }
                  >
                    <Text className="text-[13px] text-center text-foreground">
                      {isBlockChecking
                        ? 'Checking...'
                        : isBlockSubmitting
                        ? 'Updating...'
                        : isBlocked
                        ? 'Unblock'
                        : 'Block'}
                    </Text>
                  </Pressable>
                </View>

                <View className="mt-3 flex-row gap-3">
                  <Pressable
                    onPress={handleOpenMentionComposer}
                    className="flex-1 border border-border bg-surface px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel="Mention user"
                  >
                    <Text className="text-[13px] text-center text-foreground">
                      Mention
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleOpenDmComposer}
                    className="flex-1 border border-border bg-surface px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel="Send direct message"
                  >
                    <Text className="text-[13px] text-center text-foreground">
                      Message
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
                  This account is protected. Follow to view recent posts.
                </Text>
              </Surface>
            </DropShadowBox>
          ) : (
            <>
              <Text
                className="mt-4 text-[24px] font-semibold text-foreground"
                dynamicTypeRamp="title1"
              >
                Recent posts
              </Text>
              <View style={{ gap: TIMELINE_SPACING }}>
                {isRecentStatusesLoading || isHydratingRecentStatuses ? (
                  <TimelineSkeletonList
                    keyPrefix="profile-status-skeleton"
                    count={3}
                    className=""
                    style={{ gap: TIMELINE_SPACING }}
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
                  <TimelineSkeletonCard message="No recent posts yet." />
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
                  />
                ))}
              </View>
            </>
          )}

          {isLoading ? (
            <View className="items-center py-3">
              <ActivityIndicator color={accent} />
            </View>
          ) : null}
        </ScrollView>
      </NativeEdgeScrollShadow>

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
