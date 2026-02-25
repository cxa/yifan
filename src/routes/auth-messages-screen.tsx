import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';

import { COMPACT_PULL_THRESHOLD, NeobrutalRefreshIndicator } from '@/components/neobrutal-activity-indicator';
import { usePullScrollY, usePullRefreshState } from '@/components/use-pull-to-refresh';
import {
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Reply, Send, Trash2 } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { useAuthSession } from '@/auth/auth-session';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import { get, post } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import { ShimmerBar } from '@/components/timeline-skeleton-card';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import { AUTH_PROFILE_ROUTE, AUTH_STACK_ROUTE } from '@/navigation/route-names';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouUser } from '@/types/fanfou';
import { formatTimestamp } from '@/utils/format-timestamp';
import { parseHtmlToText } from '@/utils/parse-html';

const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 28;
const CARD_GAP = 16;
const POSTAGE_STAMP_PATH =
  'M14 1v1.5c-.75 0-.75 1.5 0 1.5v1.25c-.75 0-.75 1.5 0 1.5v1.5c-.75 0-.75 1.5 0 1.5V11c-.75 0-.75 1.5 0 1.5V14h-1.5c0-.75-1.5-.75-1.5 0H9.75c0-.75-1.5-.75-1.5 0h-1.5c0-.75-1.5-.75-1.5 0H4c0-.75-1.5-.75-1.5 0H1v-1.5c.75 0 .75-1.5 0-1.5V9.75c.75 0 .75-1.5 0-1.5v-1.5c.75 0 .75-1.5 0-1.5V4c.75 0 .75-1.5 0-1.5V1h1.5c0 .75 1.5.75 1.5 0h1.25c0 .75 1.5.75 1.5 0h1.5c0 .75 1.5.75 1.5 0H11c0 .75 1.5.75 1.5 0z';
const STAMP_SIZE = 44;
const STAMP_CONTENT_OFFSET = 7;
const STAMP_CONTENT_SIZE = 30;
// Wave SVG is wider so waves can bleed past the right perforation border
const STAMP_WAVE_SVG_WIDTH = Math.round(STAMP_SIZE * (18 / 15));
const STAMP_WAVE_SVG_HEIGHT = Math.round(STAMP_SIZE * (19 / 15));
const STAMP_WAVE_SVG_STYLE = { position: 'absolute' as const, top: 0, left: 0 };

// Wavy cancellation lines clustered in bottom-right; last wave bleeds past bottom border
const STAMP_WAVE_LINES: { d: string; opacity: number }[] = [
  { d: 'M7.5 9.5  C9 8.7   10.5 10.5 12 9.7  C13 9.2  14.2 9.6  16 9.3',    opacity: 0.25 },
  { d: 'M6.5 11.1 C8 10.3  9.5 12.1  11 11.3 C12.2 10.7 13.5 11.2 16 10.9', opacity: 0.5  },
  { d: 'M6   12.7 C7.5 11.9 9 13.7  10.5 12.9 C11.8 12.3 13 12.8 16 12.5',  opacity: 0.3  },
];

type MailboxKind = 'inbox' | 'outbox';

type FanfouDirectMessage = {
  id: string;
  text: string;
  created_at: string;
  sender_id?: string;
  recipient_id?: string;
  sender?: FanfouUser;
  recipient?: FanfouUser;
};

type MessageGroups = {
  inbox: FanfouDirectMessage[];
  outbox: FanfouDirectMessage[];
};

type PrivateMessagesContentProps = {
  userId: string;
};

type MessageCardProps = {
  message: FanfouDirectMessage;
  mailbox: MailboxKind;
  onPressProfile: (userId: string) => void;
  onDelete?: () => void;
  onReply?: () => void;
  stampBorderColor: string;
};

type MailboxHeaderTabsProps = {
  activeMailbox: MailboxKind;
  muted: string;
  activeIconColor: string;
  onPressTab: (next: MailboxKind) => void;
};

const MAILBOX_META: Record<
  MailboxKind,
  {
    label: string;
    emptyMessage: string;
    addressLabel: string;
    icon: React.ComponentType<{ color: string; size: number }>;
  }
> = {
  inbox: {
    label: 'Inbox',
    emptyMessage: 'No messages in inbox.',
    addressLabel: 'From',
    icon: Inbox,
  },
  outbox: {
    label: 'Outbox',
    emptyMessage: 'No messages in outbox.',
    addressLabel: 'To',
    icon: Send,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeDirectMessages = (value: unknown): FanfouDirectMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord) as FanfouDirectMessage[];
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const TimelineEmptyMessage = ({ message }: { message: string }) => (
  <DropShadowBox>
    <Surface className="bg-surface border-2 border-foreground dark:border-border px-4 py-4">
      <Text className="text-[13px] text-muted">{message}</Text>
    </Surface>
  </DropShadowBox>
);

const MessageItemSeparator = () => <View className="h-7" />;

const PostageStamp = ({
  avatarUrl,
  initial,
  borderColor,
}: {
  avatarUrl?: string;
  initial: string;
  borderColor: string;
}) => (
  <View
    className="items-center justify-center"
    style={{ width: STAMP_SIZE, height: STAMP_SIZE }}
  >
    <View
      className="absolute overflow-hidden"
      style={{
        left: STAMP_CONTENT_OFFSET,
        top: STAMP_CONTENT_OFFSET,
        width: STAMP_CONTENT_SIZE,
        height: STAMP_CONTENT_SIZE,
      }}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} className="h-full w-full" />
      ) : (
        <View className="h-full w-full items-center justify-center bg-surface-secondary">
          <Text className="text-[10px] font-semibold text-muted">
            {initial}
          </Text>
        </View>
      )}
    </View>
    <Svg
      width={STAMP_SIZE}
      height={STAMP_SIZE}
      viewBox="0 0 15 15"
      className="absolute inset-0"
    >
      <Path
        d={POSTAGE_STAMP_PATH}
        fill="none"
        stroke={borderColor}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    <Svg
      width={STAMP_WAVE_SVG_WIDTH}
      height={STAMP_WAVE_SVG_HEIGHT}
      viewBox="0 0 18 19"
      style={STAMP_WAVE_SVG_STYLE}
    >
      {STAMP_WAVE_LINES.map(({ d, opacity }, i) => (
        <Path
          key={i}
          d={d}
          fill="none"
          stroke="#E63946"
          strokeWidth="0.6"
          strokeLinecap="round"
          opacity={opacity}
        />
      ))}
    </Svg>
  </View>
);

const SKELETON_TEXT_LINE_2_STYLE = { opacity: 0.7 };

const MessageSkeletonCard = ({ shimmerIndex }: { shimmerIndex: number }) => {
  const [border] = useThemeColor(['border']);
  return (
    <DropShadowBox containerClassName="w-full">
      <View className="w-full overflow-hidden bg-white dark:bg-surface border-2 border-foreground dark:border-border px-4 pb-4 pt-5">
        <View className="flex-row gap-3">
          <PostageStamp initial="" borderColor={border} />
          <View className="flex-1">
            <View className="absolute bottom-0 left-0 top-0 w-px bg-danger/40" />
            <View className="pl-3 gap-2">
              <View className="flex-row items-baseline gap-1">
                <ShimmerBar className="h-3 w-24 bg-surface-secondary" isActive={shimmerIndex === 0} />
                <ShimmerBar className="h-2.5 w-12 bg-surface-secondary" isActive={false} />
              </View>
              <ShimmerBar className="h-3 w-full bg-surface-secondary" isActive={shimmerIndex === 1} />
              <ShimmerBar className="h-3 w-4/5 bg-surface-secondary" style={SKELETON_TEXT_LINE_2_STYLE} isActive={shimmerIndex === 2} />
              <View className="mt-1 border-t border-dashed border-border" />
              <ShimmerBar className="h-2.5 w-16 bg-surface-secondary" isActive={false} />
            </View>
          </View>
        </View>
      </View>
    </DropShadowBox>
  );
};

const MailboxHeaderTabs = ({
  activeMailbox,
  muted,
  activeIconColor,
  onPressTab,
}: MailboxHeaderTabsProps) => {
  const tabItems: MailboxKind[] = ['inbox', 'outbox'];

  return (
    <View className="flex-row gap-4">
      {tabItems.map(key => {
        const meta = MAILBOX_META[key];
        const Icon = meta.icon;
        const isActive = activeMailbox === key;

        return (
          <View key={key} className="min-w-[96px]">
            <DropShadowBox shadowOffsetClassName="-translate-x-0.5 translate-y-0.5">
              <Pressable
                onPress={() => onPressTab(key)}
                className={`w-full border border-foreground dark:border-border px-2 py-1 ${isActive
                  ? 'bg-accent'
                  : 'bg-surface active:translate-x-[-3px] active:translate-y-[3px]'
                  }`}
                accessibilityRole="button"
                accessibilityState={isActive ? { selected: true } : undefined}
                accessibilityLabel={`Open ${meta.label}`}
              >
                <View className="flex-row items-center justify-center gap-1.5">
                  <Icon color={isActive ? activeIconColor : muted} size={12} />
                  <Text
                    className={`text-[11px] ${isActive ? 'text-accent-foreground' : 'text-foreground'
                      }`}
                  >
                    {meta.label}
                  </Text>
                </View>
              </Pressable>
            </DropShadowBox>
          </View>
        );
      })}
    </View>
  );
};

const MessageCard = ({
  message,
  mailbox,
  onPressProfile,
  onDelete,
  onReply,
  stampBorderColor,
}: MessageCardProps) => {
  const counterpart = mailbox === 'inbox' ? message.sender : message.recipient;
  const counterpartId =
    counterpart?.id ||
    (mailbox === 'inbox' ? message.sender_id : message.recipient_id);
  const displayName =
    counterpart?.screen_name || counterpart?.name || counterpartId || 'Unknown';
  const handle = counterpartId ? `@${counterpartId}` : '';
  const avatarUrl = counterpart?.profile_image_url;
  const timestamp = formatTimestamp(message.created_at);
  const messageText = parseHtmlToText(message.text).trim();
  const initial = displayName.slice(0, 1).toUpperCase();
  const isPressable = Boolean(counterpartId);
  const [danger, muted] = useThemeColor(['danger', 'muted']);

  const handleDelete = () => {
    if (!onDelete) {
      return;
    }
    Alert.alert(
      'Delete message',
      `Delete this message from ${displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
      { cancelable: true },
    );
  };

  return (
    <DropShadowBox containerClassName="w-full">
      <Pressable
        onPress={() => {
          if (!counterpartId) {
            return;
          }
          onPressProfile(counterpartId);
        }}
        disabled={!isPressable}
        accessibilityRole={isPressable ? 'button' : undefined}
        className={`relative w-full overflow-hidden bg-white dark:bg-surface border-2 border-foreground dark:border-border px-4 pb-4 pt-5 ${isPressable
          ? 'active:translate-x-[-4px] active:translate-y-[4px]'
          : ''
          }`}
      >
        {onReply ? (
          <Pressable
            onPress={onReply}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reply to message"
            className="absolute right-3 top-3 z-10 active:opacity-50"
          >
            <Reply size={14} color={muted} />
          </Pressable>
        ) : null}
        <View className="flex-row gap-3">
          <PostageStamp
            avatarUrl={avatarUrl}
            initial={initial}
            borderColor={stampBorderColor}
          />

          <View className="relative flex-1">
            <View className="absolute bottom-0 left-0 top-0 w-px bg-danger/40" />

            <View className="pl-3">
              <View className="min-w-0 flex-row items-baseline gap-1">
                <Text
                  className="shrink text-[16px] font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                {handle ? (
                  <Text className="shrink-0 text-[12px] text-muted">
                    {handle}
                  </Text>
                ) : null}
              </View>

              {messageText ? (
                <Text className="mt-2 text-[14px] leading-6 text-foreground">
                  {messageText}
                </Text>
              ) : null}

              <View className="relative mt-3 border-t border-dashed border-border">
                <View className="absolute left-[-15px] top-[-4px] h-2 w-2 rounded-full border border-border bg-surface-secondary" />
              </View>

              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-[11px] text-muted">{timestamp}</Text>
                {onDelete ? (
                  <Pressable
                    onPress={handleDelete}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete message"
                    className="active:opacity-50"
                  >
                    <Trash2 size={14} color={danger} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </DropShadowBox>
  );
};

const PrivateMessagesContent = ({ userId }: PrivateMessagesContentProps) => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const inboxListRef = useRef<FlatList<FanfouDirectMessage>>(null);
  const outboxListRef = useRef<FlatList<FanfouDirectMessage>>(null);
  const insets = useSafeAreaInsets();
  const [background, muted, accentForeground, border] = useThemeColor([
    'background',
    'muted',
    'accent-foreground',
    'border',
  ]);
  const queryClient = useQueryClient();
  const [activeMailbox, setActiveMailbox] = useState<MailboxKind>('inbox');
  const [replyTarget, setReplyTarget] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);

  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } = usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      updatePullScrollY(event.contentOffset.y);
    },
  });

  useScrollToTop(inboxListRef);
  useScrollToTop(outboxListRef);

  const parentNavigation =
    navigation.getParent<NavigationProp<AuthStackParamList>>();

  const { data, isLoading, error, refetch } =
    useQuery<MessageGroups>({
      queryKey: ['private-messages', userId],
      queryFn: async () => {
        const [inboxData, sentData] = await Promise.all([
          get('/direct_messages/inbox', { count: 40 }),
          get('/direct_messages/sent', { count: 40 }),
        ]);
        return {
          inbox: normalizeDirectMessages(inboxData),
          outbox: normalizeDirectMessages(sentData),
        };
      },
      retry: 1,
    });

  const inboxItems = data?.inbox ?? [];
  const outboxItems = data?.outbox ?? [];
  const totalMailboxCount = inboxItems.length + outboxItems.length;

  const renderHeaderTabs = useCallback(
    () => (
      <MailboxHeaderTabs
        activeMailbox={activeMailbox}
        muted={muted}
        activeIconColor={accentForeground}
        onPressTab={setActiveMailbox}
      />
    ),
    [accentForeground, activeMailbox, muted],
  );

  useLayoutEffect(() => {
    if (!parentNavigation) {
      return undefined;
    }

    parentNavigation.setOptions({
      title: '',
      headerTitle: renderHeaderTabs,
      headerTitleAlign: 'center',
      headerBackButtonDisplayMode: 'minimal',
      headerBackTitle: '',
    });

    return () => {
      parentNavigation.setOptions({
        title: 'Private messages',
        headerTitle: undefined,
        headerTitleAlign: undefined,
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: undefined,
      });
    };
  }, [parentNavigation, renderHeaderTabs, totalMailboxCount]);

  const errorMessage = error
    ? getErrorMessage(error, 'Failed to load private messages.')
    : null;

  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: PAGE_HORIZONTAL_PADDING,
      paddingTop: 0,
      paddingBottom: insets.bottom + PAGE_BOTTOM_PADDING,
      flexGrow: 1,
    }),
    [insets.bottom],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await post('/direct_messages/destroy', { id: messageId });
        queryClient.setQueryData<MessageGroups>(
          ['private-messages', userId],
          prev => {
            if (!prev) {
              return prev;
            }
            return {
              inbox: prev.inbox.filter(m => m.id !== messageId),
              outbox: prev.outbox.filter(m => m.id !== messageId),
            };
          },
        );
      } catch (deleteError) {
        Alert.alert(
          'Delete failed',
          getErrorMessage(deleteError, 'Failed to delete message.'),
        );
      }
    },
    [queryClient, userId],
  );

  const handleSubmitReply = useCallback(
    async ({ text }: ComposerModalSubmitPayload) => {
      if (!replyTarget) {
        return;
      }
      const trimmedText = text.trim();
      if (!trimmedText) {
        Alert.alert('Cannot send', 'Please enter a message.');
        return;
      }
      try {
        await post('/direct_messages/new', {
          user: replyTarget.userId,
          text: trimmedText,
        });
        setReplyTarget(null);
        await refetch();
      } catch (replyError) {
        Alert.alert(
          'Reply failed',
          getErrorMessage(replyError, 'Failed to send reply.'),
        );
      }
    },
    [replyTarget, refetch],
  );

  const handleOpenProfile = useCallback(
    (targetUserId: string) => {
      navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
        screen: AUTH_PROFILE_ROUTE.DETAIL,
        params: { userId: targetUserId },
      });
    },
    [navigation],
  );

  const { isPullRefreshing, handlePullRefresh } = usePullRefreshState(refetch);
  const createRefreshControl = () => (
    <RefreshControl
      refreshing={isPullRefreshing}
      onRefresh={handlePullRefresh}
      tintColor="transparent"
      colors={['transparent']}
    />
  );

  const renderMailboxList = (
    mailbox: MailboxKind,
    mailboxItems: FanfouDirectMessage[],
    listRef: React.RefObject<FlatList<FanfouDirectMessage> | null>,
  ) => (
    <>
      <NativeEdgeScrollShadow className="flex-1" color={background}>
        <Animated.FlatList
          ref={listRef}
          className="flex-1 bg-background"
          data={mailboxItems}
          keyExtractor={item => `${mailbox}-${item.id}`}
          renderItem={({ item }) => {
            const sender = item.sender;
            const senderId = sender?.id || item.sender_id;
            return (
              <MessageCard
                message={item}
                mailbox={mailbox}
                onPressProfile={handleOpenProfile}
                onDelete={() => handleDeleteMessage(item.id)}
                onReply={
                  mailbox === 'inbox' && senderId
                    ? () =>
                      setReplyTarget({
                        userId: senderId,
                        displayName:
                          sender?.screen_name || sender?.name || senderId,
                      })
                    : undefined
                }
                stampBorderColor={border}
              />
            );
          }}
          onScroll={scrollHandler}
          contentInsetAdjustmentBehavior="automatic"
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          contentContainerStyle={contentContainerStyle}
          refreshControl={createRefreshControl()}
          ListHeaderComponent={
            errorMessage ? (
              <Surface className="bg-danger-soft px-4 py-3">
                <Text className="text-[13px] text-danger-foreground">
                  {errorMessage}
                </Text>
              </Surface>
            ) : null
          }
          ListHeaderComponentStyle={
            errorMessage ? { marginBottom: CARD_GAP } : undefined
          }
          ItemSeparatorComponent={MessageItemSeparator}
          ListEmptyComponent={
            isLoading ? (
              <View className="gap-7">
                {Array.from({ length: 5 }).map((_, i) => (
                  <MessageSkeletonCard key={i} shimmerIndex={i % 3} />
                ))}
              </View>
            ) : (
              <TimelineEmptyMessage
                message={MAILBOX_META[mailbox].emptyMessage}
              />
            )
          }
        />
      </NativeEdgeScrollShadow>
      <NeobrutalRefreshIndicator refreshing={isPullRefreshing} scrollY={pullScrollY} safeAreaTop={safeAreaTop} scrollInsetTop={scrollInsetTop} pullThreshold={COMPACT_PULL_THRESHOLD} />
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <View className={activeMailbox === 'inbox' ? 'flex-1' : 'hidden'}>
        {renderMailboxList('inbox', inboxItems, inboxListRef)}
      </View>
      <View className={activeMailbox === 'outbox' ? 'flex-1' : 'hidden'}>
        {renderMailboxList('outbox', outboxItems, outboxListRef)}
      </View>

      <ComposerModal
        visible={replyTarget !== null}
        title={replyTarget ? `Reply to @${replyTarget.displayName}` : ''}
        placeholder="Write your reply..."
        submitLabel="Send"
        topInset={insets.top}
        resetKey={replyTarget ? `dm-reply:${replyTarget.userId}` : ''}
        onCancel={() => setReplyTarget(null)}
        onSubmit={handleSubmitReply}
      />
    </View>
  );
};

const PrivateMessagesRoute = () => {
  const auth = useAuthSession();
  const accessToken = auth.accessToken;

  if (!accessToken) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            Missing authenticated user.
          </Text>
        </Surface>
      </View>
    );
  }

  return <PrivateMessagesContent userId={accessToken.userId} />;
};

export default PrivateMessagesRoute;
