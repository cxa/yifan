import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { Inbox, Send } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { useAuthSession } from '@/auth/auth-session';
import { get } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import { AUTH_PROFILE_ROUTE, AUTH_STACK_ROUTE } from '@/navigation/route-names';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouUser } from '@/types/fanfou';
import { formatTimestamp } from '@/utils/format-timestamp';
import { parseHtmlToText } from '@/utils/parse-html';

const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_TOP_PADDING = 24;
const PAGE_BOTTOM_PADDING = 28;
const CARD_GAP = 16;
const POSTAGE_STAMP_PATH =
  'M14 1v1.5c-.75 0-.75 1.5 0 1.5v1.25c-.75 0-.75 1.5 0 1.5v1.5c-.75 0-.75 1.5 0 1.5V11c-.75 0-.75 1.5 0 1.5V14h-1.5c0-.75-1.5-.75-1.5 0H9.75c0-.75-1.5-.75-1.5 0h-1.5c0-.75-1.5-.75-1.5 0H4c0-.75-1.5-.75-1.5 0H1v-1.5c.75 0 .75-1.5 0-1.5V9.75c.75 0 .75-1.5 0-1.5v-1.5c.75 0 .75-1.5 0-1.5V4c.75 0 .75-1.5 0-1.5V1h1.5c0 .75 1.5.75 1.5 0h1.25c0 .75 1.5.75 1.5 0h1.5c0 .75 1.5.75 1.5 0H11c0 .75 1.5.75 1.5 0z';
const STAMP_SIZE = 44;
const STAMP_CONTENT_OFFSET = 7;
const STAMP_CONTENT_SIZE = 30;

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
  </View>
);

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
                className={`w-full border border-foreground dark:border-border px-2 py-1 ${
                  isActive
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
                    className={`text-[11px] ${
                      isActive ? 'text-accent-foreground' : 'text-foreground'
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
        className={`relative w-full overflow-hidden bg-white dark:bg-surface border-2 border-foreground dark:border-border px-4 pb-4 pt-5 ${
          isPressable
            ? 'active:translate-x-[-4px] active:translate-y-[4px]'
            : ''
        }`}
      >
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

              <Text className="mt-2 text-[11px] text-muted">{timestamp}</Text>
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
  const [accent, background, muted, accentForeground, border] = useThemeColor([
    'accent',
    'background',
    'muted',
    'accent-foreground',
    'border',
  ]);
  const [activeMailbox, setActiveMailbox] = useState<MailboxKind>('inbox');

  useScrollToTop(inboxListRef);
  useScrollToTop(outboxListRef);

  const parentNavigation =
    navigation.getParent<NavigationProp<AuthStackParamList>>();

  const { data, isLoading, isRefetching, error, refetch } =
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
      paddingTop: PAGE_TOP_PADDING,
      paddingBottom: insets.bottom + PAGE_BOTTOM_PADDING,
      flexGrow: 1,
    }),
    [insets.bottom],
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

  const createRefreshControl = () => (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={async () => {
        await refetch();
      }}
      tintColor={accent}
      colors={[accent]}
      progressViewOffset={Math.max(44, insets.top)}
      progressBackgroundColor={background}
    />
  );

  const renderMailboxList = (
    mailbox: MailboxKind,
    items: FanfouDirectMessage[],
    listRef: React.RefObject<FlatList<FanfouDirectMessage> | null>,
  ) => (
    <NativeEdgeScrollShadow className="flex-1" color={background}>
      <FlatList
        ref={listRef}
        className="flex-1 bg-background"
        data={items}
        keyExtractor={item => `${mailbox}-${item.id}`}
        renderItem={({ item }) => (
          <MessageCard
            message={item}
            mailbox={mailbox}
            onPressProfile={handleOpenProfile}
            stampBorderColor={border}
          />
        )}
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
            <View className="items-center py-8">
              <ActivityIndicator color={accent} />
            </View>
          ) : (
            <TimelineEmptyMessage
              message={MAILBOX_META[mailbox].emptyMessage}
            />
          )
        }
      />
    </NativeEdgeScrollShadow>
  );

  return (
    <View className="flex-1 bg-background">
      <View className={activeMailbox === 'inbox' ? 'flex-1' : 'hidden'}>
        {renderMailboxList('inbox', inboxItems, inboxListRef)}
      </View>
      <View className={activeMailbox === 'outbox' ? 'flex-1' : 'hidden'}>
        {renderMailboxList('outbox', outboxItems, outboxListRef)}
      </View>
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
