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
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/auth/auth-session';
import { get, post, uploadPhoto } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal from '@/components/composer-modal';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import TimelineSkeletonCard from '@/components/timeline-skeleton-card';
import { TIMELINE_SPACING } from '@/components/timeline-list-settings';
import type {
  AuthProfileScreenParamList,
  AuthStackParamList,
} from '@/navigation/types';
import type { FanfouStatus, FanfouUser } from '@/types/fanfou';
import { formatTimestamp } from '@/utils/format-timestamp';
import {
  pickImageFromLibrary,
  type PickedImage,
} from '@/utils/pick-image-from-library';
import { parseHtmlToSegments, parseHtmlToText } from '@/utils/parse-html';

const PROFILE_CARD_GAP = 16;
const FANFOU_DATE_REGEX =
  /^[A-Za-z]{3}\s([A-Za-z]{3})\s(\d{1,2})\s(\d{2}):(\d{2}):(\d{2})\s([+-]\d{4})\s(\d{4})$/;
const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ComposerMode = 'mention' | 'dm' | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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

const parseFanfouDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const match = value.match(FANFOU_DATE_REGEX);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const [, monthLabel, dayRaw, hourRaw, minuteRaw, secondRaw, tzRaw, yearRaw] =
    match;
  const month = MONTHS[monthLabel];
  if (month === undefined) {
    return null;
  }
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const year = Number(yearRaw);
  if (
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    Number.isNaN(year)
  ) {
    return null;
  }
  const sign = tzRaw.startsWith('-') ? -1 : 1;
  const tzHours = Number(tzRaw.slice(1, 3));
  const tzMinutes = Number(tzRaw.slice(3, 5));
  if (Number.isNaN(tzHours) || Number.isNaN(tzMinutes)) {
    return null;
  }
  const offsetMinutes = sign * (tzHours * 60 + tzMinutes);
  const utcMillis =
    Date.UTC(year, month, day, hour, minute, second) -
    offsetMinutes * 60 * 1000;

  return new Date(utcMillis);
};

const formatJoinedAt = (value?: string) => {
  const date = parseFanfouDate(value);
  if (!date) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 7);
  }
};

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
  const [accent, background] = useThemeColor(['accent', 'background']);

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
  const [composeText, setComposeText] = useState('');
  const [composePhoto, setComposePhoto] = useState<PickedImage | null>(null);
  const [isComposePhotoPicking, setIsComposePhotoPicking] = useState(false);
  const [isComposeSubmitting, setIsComposeSubmitting] = useState(false);

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

  const normalizedRouteUserId = routeUserId.toLowerCase();
  const normalizedAuthScreenName = auth.accessToken?.screenName?.toLowerCase();
  const currentUserId = user ? user.id : null;
  const currentUserScreenName = user ? user.screen_name : null;
  const normalizedCurrentUserScreenName = currentUserScreenName
    ? currentUserScreenName.toLowerCase()
    : null;

  const isSelf =
    (Boolean(currentUserId) &&
      Boolean(auth.accessToken?.userId) &&
      currentUserId === auth.accessToken?.userId) ||
    (Boolean(normalizedCurrentUserScreenName) &&
      Boolean(normalizedAuthScreenName) &&
      normalizedCurrentUserScreenName === normalizedAuthScreenName) ||
    (Boolean(normalizedRouteUserId) &&
      Boolean(normalizedAuthScreenName) &&
      normalizedRouteUserId === normalizedAuthScreenName);

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

  const {
    data: recentStatuses = [],
    isLoading: isRecentStatusesLoading,
    error: recentStatusesError,
    refetch: refetchRecentStatuses,
  } = useQuery<FanfouStatus[]>({
    queryKey: ['profile', 'recent-statuses', routeUserId, currentUserId],
    queryFn: async () => {
      const targetUserId = currentUserId || routeUserId;
      const data = await getRecentStatusesByUserId(targetUserId);
      return normalizeTimelineItems(data);
    },
    enabled: Boolean(user) && !isProtectedTimeline,
  });

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
      navigation.navigate('route_root._auth.profile', {
        screen: 'route_root._auth.profile._handle',
        params: { userId: targetUserId },
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

  const handleOpenMentionComposer = useCallback(() => {
    const mentionTarget = user ? user.screen_name : '';
    setComposeMode('mention');
    setComposeText(mentionTarget ? `@${mentionTarget} ` : '');
    setComposePhoto(null);
  }, [user]);

  const handleOpenDmComposer = useCallback(() => {
    setComposeMode('dm');
    setComposeText('');
    setComposePhoto(null);
  }, []);

  const handleCloseComposer = useCallback(() => {
    if (isComposeSubmitting || isComposePhotoPicking) {
      return;
    }
    setComposeMode(null);
    setComposeText('');
    setComposePhoto(null);
  }, [isComposePhotoPicking, isComposeSubmitting]);

  const handlePickComposePhoto = useCallback(async () => {
    if (
      composeMode !== 'mention' ||
      isComposeSubmitting ||
      isComposePhotoPicking
    ) {
      return;
    }

    setIsComposePhotoPicking(true);
    try {
      const pickedPhoto = await pickImageFromLibrary();
      if (pickedPhoto) {
        setComposePhoto(pickedPhoto);
      }
    } catch (requestError) {
      Alert.alert(
        'Unable to attach photo',
        getErrorMessage(requestError, 'Please try again.'),
      );
    } finally {
      setIsComposePhotoPicking(false);
    }
  }, [composeMode, isComposePhotoPicking, isComposeSubmitting]);

  const handleRemoveComposePhoto = useCallback(() => {
    if (isComposeSubmitting) {
      return;
    }
    setComposePhoto(null);
  }, [isComposeSubmitting]);

  const handleSendComposer = useCallback(async () => {
    if (!user || !composeMode || isComposeSubmitting || isComposePhotoPicking) {
      return;
    }

    const text = composeText.trim();
    const hasPhoto = Boolean(composePhoto?.base64);
    if (!text && !hasPhoto) {
      Alert.alert('Cannot send', 'Please enter text or attach a photo.');
      return;
    }

    setIsComposeSubmitting(true);

    try {
      if (composeMode === 'mention') {
        if (composePhoto?.base64) {
          await uploadPhoto({
            photoBase64: composePhoto.base64,
            status: text || undefined,
            params: {
              in_reply_to_user_id: user.id,
            },
          });
        } else {
          await post('/statuses/update', {
            status: text,
            in_reply_to_user_id: user.id,
          });
        }
      } else {
        await post('/direct_messages/new', {
          user: user.id,
          text,
        });
      }

      setComposeMode(null);
      setComposeText('');
      setComposePhoto(null);
      Alert.alert(
        'Sent',
        composeMode === 'mention' ? 'Mention posted.' : 'Direct message sent.',
      );
    } catch (requestError) {
      Alert.alert(
        'Send failed',
        getErrorMessage(requestError, 'Unable to send message.'),
      );
    } finally {
      setIsComposeSubmitting(false);
    }
  }, [
    composeMode,
    composePhoto?.base64,
    composeText,
    isComposePhotoPicking,
    isComposeSubmitting,
    user,
  ]);

  const profileErrorMessage = error
    ? getErrorMessage(error, 'Failed to load profile.')
    : null;

  const recentStatusesErrorMessage = recentStatusesError
    ? getErrorMessage(recentStatusesError, 'Failed to load recent posts.')
    : null;

  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: insets.bottom + TIMELINE_SPACING,
      gap: PROFILE_CARD_GAP,
    }),
    [insets.bottom],
  );
  const rootSafeAreaStyle = useMemo(
    () => ({
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }),
    [insets.left, insets.right, insets.top],
  );

  if (isLoading && !user) {
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
              @{routeUserId}
            </Text>
          </View>
          <View className="w-[58px]" />
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={accent} />
        </View>
      </View>
    );
  }

  if (!user) {
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
              @{routeUserId}
            </Text>
          </View>
          <View className="w-[58px]" />
        </View>

        <View className="px-4">
          <Surface className="bg-danger-soft px-4 py-3">
            <Text className="text-[13px] text-danger-foreground">
              {profileErrorMessage ?? 'Failed to load profile.'}
            </Text>
          </Surface>
        </View>
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

  const statsPrimary = [
    { label: 'Posts', value: user.statuses_count },
    { label: 'Following', value: user.friends_count },
    { label: 'Followers', value: user.followers_count },
  ];

  const statsSecondary = [
    { label: 'Favorites', value: user.favourites_count },
    { label: 'Photos', value: user.photo_count },
  ];

  const composerTitle =
    composeMode === 'dm' ? `Message ${handleName}` : `Mention ${handleName}`;
  const composerPlaceholder =
    composeMode === 'dm'
      ? 'Write a private message...'
      : 'Write your mention...';
  const composerSubmitLabel = composeMode === 'dm' ? 'Send' : 'Post';

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
              {displayName}
            </Text>
          </View>
          <View className="w-[58px]" />
        </View>

        <ScrollView
          className="flex-1"
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
          <View className="relative mb-4">
            <View className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border -translate-x-2 translate-y-2" />
            <Surface className="bg-surface border-2 border-foreground dark:border-border px-5 py-6">
              <View className="flex-row items-start gap-5">
                {hasAvatar ? (
                  <View
                    className={
                      photoViewerVisible &&
                      photoViewerPreviewKey === 'profile-avatar'
                        ? 'opacity-0'
                        : undefined
                    }
                  >
                    <Pressable
                      onPress={() =>
                        handlePhotoPress(avatarUrl, 'profile-avatar')
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Open avatar"
                    >
                      <View
                        ref={node =>
                          registerPhotoPreviewRef('profile-avatar', node)
                        }
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
                ) : null}

                {hasAvatar ? null : (
                  <View className="h-20 w-20 items-center justify-center rounded-full bg-surface-secondary">
                    <Text className="text-[24px] text-muted">
                      {displayName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View className="flex-1 gap-2">
                  <Text className="text-[22px] leading-[28px] text-foreground">
                    {displayName}
                  </Text>
                  {handleName ? (
                    <Text className="text-[14px] text-muted">{handleName}</Text>
                  ) : null}
                  {user.location ? (
                    <Text className="text-[13px] text-muted">
                      {user.location}
                    </Text>
                  ) : null}
                  {joinedAt ? (
                    <Text className="text-[12px] text-muted">
                      Joined {joinedAt}
                    </Text>
                  ) : null}
                </View>
              </View>

              {profileUrl ? (
                <Text className="mt-4 text-[13px] text-accent">
                  {profileUrl}
                </Text>
              ) : null}

              {description ? (
                <Text className="mt-4 text-[14px] leading-6 text-foreground">
                  {description}
                </Text>
              ) : null}
            </Surface>
          </View>

          <View className="flex-row gap-4">
            {statsPrimary.map(stat => (
              <View key={stat.label} className="relative flex-1 pb-2">
                <View className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border -translate-x-2 translate-y-2" />
                <Surface className="bg-surface border-2 border-foreground dark:border-border px-4 py-4">
                  <Text
                    className="text-[20px] leading-6 text-foreground"
                    numberOfLines={1}
                  >
                    {stat.value ?? '--'}
                  </Text>
                  <Text className="mt-2 text-[12px] text-foreground">
                    {stat.label}
                  </Text>
                </Surface>
              </View>
            ))}
          </View>

          <View className="flex-row gap-4">
            {statsSecondary.map(stat => (
              <View key={stat.label} className="relative flex-1 pb-2">
                <View className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border -translate-x-2 translate-y-2" />
                <Surface className="bg-surface border-2 border-foreground dark:border-border px-4 py-4">
                  <Text
                    className="text-[20px] leading-6 text-foreground"
                    numberOfLines={1}
                  >
                    {stat.value ?? '--'}
                  </Text>
                  <Text className="mt-2 text-[12px] text-foreground">
                    {stat.label}
                  </Text>
                </Surface>
              </View>
            ))}
          </View>

          {isSelf ? (
            <View className="relative pb-2">
              <View className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border -translate-x-2 translate-y-2" />
              <Surface className="bg-surface-secondary border-2 border-foreground dark:border-border px-4 py-4">
                <Pressable
                  disabled
                  className="border border-border bg-surface px-3 py-2 opacity-60"
                >
                  <Text className="text-[13px] text-foreground">
                    Edit profile (Soon)
                  </Text>
                </Pressable>
              </Surface>
            </View>
          ) : (
            <View className="relative pb-2">
              <View className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border -translate-x-2 translate-y-2" />
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
            </View>
          )}

          {profileErrorMessage ? (
            <Surface className="bg-danger-soft px-4 py-3">
              <Text className="text-[13px] text-danger-foreground">
                {profileErrorMessage}
              </Text>
            </Surface>
          ) : null}

          {isProtectedTimeline ? (
            <Surface className="bg-surface-secondary border border-border px-4 py-4">
              <Text className="text-[14px] leading-6 text-muted">
                This account is protected. Follow to view recent posts.
              </Text>
            </Surface>
          ) : (
            <>
              <Text
                className="mt-4 text-[24px] font-semibold text-foreground"
                dynamicTypeRamp="title1"
              >
                Recent posts
              </Text>
              <View style={{ gap: TIMELINE_SPACING }}>
                {isRecentStatusesLoading ? (
                  <View style={{ gap: TIMELINE_SPACING }}>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <TimelineSkeletonCard
                        key={`profile-status-skeleton-${index}`}
                        lineCount={index % 2 === 0 ? 2 : 3}
                      />
                    ))}
                  </View>
                ) : null}

                {recentStatusesErrorMessage ? (
                  <Surface className="bg-danger-soft px-4 py-3">
                    <Text className="text-[13px] text-danger-foreground">
                      {recentStatusesErrorMessage}
                    </Text>
                  </Surface>
                ) : null}

                {!isRecentStatusesLoading &&
                recentStatuses.length === 0 &&
                !recentStatusesErrorMessage ? (
                  <TimelineSkeletonCard message="No recent posts yet." />
                ) : null}

                {recentStatuses.map(status => {
                  const statusKey = getStatusId(status);
                  const segments = parseHtmlToSegments(
                    status.text || status.status || '',
                  );
                  const photoUrl = getStatusPhotoUrl(status);
                  const photoPreviewKey = `${statusKey}-photo`;
                  const timestamp = formatTimestamp(status.created_at);
                  const sourceLabel = status.source
                    ? parseHtmlToText(status.source).trim()
                    : '';

                  return (
                    <View key={statusKey} className="relative">
                      <View className="absolute left-0 top-0 h-full w-full bg-foreground dark:bg-border -translate-x-2 translate-y-2" />
                      <Surface className="bg-surface border-2 border-foreground dark:border-border px-4 py-4">
                        <Text className="text-[15px] leading-6 text-foreground">
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

                        <View className="mt-3 flex-row items-center justify-between">
                          <Text className="text-[12px] text-muted">
                            {timestamp}
                          </Text>
                          {sourceLabel ? (
                            <Text
                              className="ml-2 text-[12px] text-muted"
                              numberOfLines={1}
                            >
                              {`via ${sourceLabel}`}
                            </Text>
                          ) : null}
                        </View>
                      </Surface>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {isLoading ? (
            <View className="items-center py-3">
              <ActivityIndicator color={accent} />
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
        value={composeText}
        isSubmitting={isComposeSubmitting}
        topInset={insets.top}
        photoUri={composeMode === 'mention' ? composePhoto?.uri : null}
        isPhotoPicking={isComposePhotoPicking}
        onChangeText={setComposeText}
        onPickPhoto={
          composeMode === 'mention' ? handlePickComposePhoto : undefined
        }
        onRemovePhoto={
          composeMode === 'mention' ? handleRemoveComposePhoto : undefined
        }
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};

const ProfileRoute = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route =
    useRoute<
      RouteProp<
        AuthProfileScreenParamList,
        'route_root._auth.profile._handle.index'
      >
    >();
  const insets = useSafeAreaInsets();
  const routeUserId = normalizeUserId(route.params?.userId);
  const rootSafeAreaStyle = useMemo(
    () => ({
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }),
    [insets.left, insets.right, insets.top],
  );

  if (!routeUserId) {
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
              Profile
            </Text>
          </View>
          <View className="w-[58px]" />
        </View>

        <View className="px-4">
          <Surface className="bg-danger-soft px-4 py-3">
            <Text className="text-[13px] text-danger-foreground">
              Missing profile user id.
            </Text>
          </Surface>
        </View>
      </View>
    );
  }

  return <ProfileRouteContent routeUserId={routeUserId} />;
};

export default ProfileRoute;
