import React, { useLayoutEffect, useRef, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTranslation } from 'react-i18next';
import {
  COMPACT_PULL_THRESHOLD,
  NeobrutalRefreshIndicator,
} from '@/components/neobrutal-activity-indicator';
import {
  usePullScrollY,
  usePullRefreshState,
} from '@/components/use-pull-to-refresh';
import {
  useNavigation,
  useScrollToTop,
  type NavigationProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Dialog, Tabs, useThemeColor } from 'heroui-native';
import ErrorBanner from '@/components/error-banner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Inbox, Reply, Send, Trash2, UserX } from 'lucide-react-native';
import TimelineEmptyPlaceholder from '@/components/timeline-empty-placeholder';
import Svg, { Path } from 'react-native-svg';
import { useAuthSession } from '@/auth/auth-session';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import { get, post } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import DropShadowBox, {
  CARD_BG_DARK,
  CARD_BG_LIGHT,
  CARD_PASTEL_CYCLE,
  type DropShadowBoxType,
} from '@/components/drop-shadow-box';
import { ShimmerBar } from '@/components/timeline-skeleton-card';
import { APP_THEME_OPTION, useAppThemePreference } from '@/settings/app-theme-preference';
import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import { countSkeletonItemsForHeight } from '@/components/timeline-skeleton-list';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import { AUTH_PROFILE_ROUTE, AUTH_STACK_ROUTE } from '@/navigation/route-names';
import type { AuthStackParamList } from '@/navigation/types';
import { useDirectMessageMutation } from '@/query/post-mutations';
import type { FanfouUser } from '@/types/fanfou';
import { formatTimestamp } from '@/utils/format-timestamp';
import { parseHtmlToText } from '@/utils/parse-html';
import { useReadableContentInsets } from '@/navigation/readable-content-guide';
const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 28;
const CARD_GAP = 16;
const MESSAGE_SKELETON_ITEM_HEIGHT = 125; // pt-5(20)+pb-4(16)+content(79)+border(4)+shadow(6)
const MESSAGE_SKELETON_GAP = 16; // gap-4
const MESSAGE_SKELETON_FALLBACK_COUNT = 5;
const NAV_HEADER_HEIGHT = 44;
const POSTAGE_STAMP_PATH =
  'M14 1v1.5c-.75 0-.75 1.5 0 1.5v1.25c-.75 0-.75 1.5 0 1.5v1.5c-.75 0-.75 1.5 0 1.5V11c-.75 0-.75 1.5 0 1.5V14h-1.5c0-.75-1.5-.75-1.5 0H9.75c0-.75-1.5-.75-1.5 0h-1.5c0-.75-1.5-.75-1.5 0H4c0-.75-1.5-.75-1.5 0H1v-1.5c.75 0 .75-1.5 0-1.5V9.75c.75 0 .75-1.5 0-1.5v-1.5c.75 0 .75-1.5 0-1.5V4c.75 0 .75-1.5 0-1.5V1h1.5c0 .75 1.5.75 1.5 0h1.25c0 .75 1.5.75 1.5 0h1.5c0 .75 1.5.75 1.5 0H11c0 .75 1.5.75 1.5 0z';
const STAMP_SIZE = 44;
const STAMP_CONTENT_OFFSET = 7;
const STAMP_CONTENT_SIZE = 30;
// Wave SVG is wider so waves can bleed past the right perforation border
const STAMP_WAVE_SVG_WIDTH = Math.round(STAMP_SIZE * (18 / 15));
const STAMP_WAVE_SVG_HEIGHT = Math.round(STAMP_SIZE * (19 / 15));
const STAMP_WAVE_SVG_STYLE = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
};

// Wavy cancellation lines clustered in bottom-right; last wave bleeds past bottom border
const STAMP_WAVE_LINES: {
  d: string;
  opacity: number;
}[] = [
    {
      d: 'M7.5 9.5  C9 8.7   10.5 10.5 12 9.7  C13 9.2  14.2 9.6  16 9.3',
      opacity: 0.25,
    },
    {
      d: 'M6.5 11.1 C8 10.3  9.5 12.1  11 11.3 C12.2 10.7 13.5 11.2 16 10.9',
      opacity: 0.5,
    },
    {
      d: 'M6   12.7 C7.5 11.9 9 13.7  10.5 12.9 C11.8 12.3 13 12.8 16 12.5',
      opacity: 0.3,
    },
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
  shadowType: DropShadowBoxType;
  onPressProfile: (userId: string) => void;
  onDelete?: () => void;
  onReply?: () => void;
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
  <TimelineEmptyPlaceholder icon={Inbox} message={message} />
);
const MessageItemSeparator = () => <View className="h-4" />;
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
    style={{
      width: STAMP_SIZE,
      height: STAMP_SIZE,
    }}
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
        <Image
          source={{
            uri: avatarUrl,
          }}
          className="h-full w-full"
        />
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
        strokeWidth="0.7"
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
const SKELETON_TEXT_LINE_2_STYLE = {
  opacity: 0.7,
};
const MessageSkeletonCard = ({
  shimmerIndex,
  colorIndex,
}: {
  shimmerIndex: number;
  colorIndex: number;
}) => {
  const isDark = useEffectiveIsDark();
  const themePreference = useAppThemePreference();
  const isPlain = themePreference === APP_THEME_OPTION.PLAIN;
  const shadowType = CARD_PASTEL_CYCLE[colorIndex % CARD_PASTEL_CYCLE.length];
  const skeletonBgStyle = {
    backgroundColor: isPlain
      ? (isDark ? '#1E1E1E' : '#FFFFFF')
      : (isDark ? CARD_BG_DARK : CARD_BG_LIGHT)[shadowType],
  };
  const dividerColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  return (
    <DropShadowBox containerClassName="w-full">
      <View style={skeletonBgStyle} className="w-full overflow-hidden rounded-3xl border border-border/40 px-4 pb-4 pt-5">
        <View className="flex-row gap-3">
          <PostageStamp initial="" borderColor={dividerColor} />
          <View className="flex-1">
            <View className="absolute bottom-0 left-0 top-0 w-0.5 bg-danger/50" />
            <View className="pl-3 gap-2">
              <View className="flex-row items-baseline gap-1">
                <ShimmerBar
                  className="h-3 w-24 bg-surface-secondary"
                  isActive={shimmerIndex === 0}
                />
                <ShimmerBar
                  className="h-2.5 w-12 bg-surface-secondary"
                  isActive={false}
                />
              </View>
              <ShimmerBar
                className="h-3 w-full bg-surface-secondary"
                isActive={shimmerIndex === 1}
              />
              <ShimmerBar
                className="h-3 w-4/5 bg-surface-secondary"
                style={SKELETON_TEXT_LINE_2_STYLE}
                isActive={shimmerIndex === 2}
              />
              <View className="mt-1 border-t border-dashed" style={{ borderColor: dividerColor }} />
              <ShimmerBar
                className="h-2.5 w-16 bg-surface-secondary"
                isActive={false}
              />
            </View>
          </View>
        </View>
      </View>
    </DropShadowBox>
  );
};
const MessageCard = ({
  message,
  mailbox,
  shadowType,
  onPressProfile,
  onDelete,
  onReply,
}: MessageCardProps) => {
  const isDark = useEffectiveIsDark();
  const themePreference = useAppThemePreference();
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
  const cardBgStyle = {
    backgroundColor: themePreference === APP_THEME_OPTION.PLAIN
      ? (isDark ? '#1E1E1E' : '#FFFFFF')
      : (isDark ? CARD_BG_DARK : CARD_BG_LIGHT)[shadowType],
  };
  const [danger, muted] = useThemeColor(['danger', 'muted']);
  const dividerColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const handleDelete = () => {
    onDelete?.();
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
        style={cardBgStyle}
        accessibilityRole={isPressable ? 'button' : undefined}
        className={`relative w-full overflow-hidden rounded-3xl border border-border/40 px-4 pb-4 pt-5 ${isPressable
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
            borderColor={dividerColor}
          />

          <View className="relative flex-1">
            <View className="absolute bottom-0 left-0 top-0 w-0.5 bg-danger/50" />

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

              <View className="relative mt-3 border-t border-dashed" style={{ borderColor: dividerColor }}>
                <View className="absolute left-[-15px] top-[-4px] size-2 rounded-full border bg-surface-secondary" />
              </View>

              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-[12px] text-muted">{timestamp}</Text>
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
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const inboxListRef = useRef<FlatList<FanfouDirectMessage>>(null);
  const outboxListRef = useRef<FlatList<FanfouDirectMessage>>(null);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { height: windowHeight } = useWindowDimensions();
  const skeletonAvailableHeight =
    windowHeight -
    insets.top -
    NAV_HEADER_HEIGHT -
    insets.bottom -
    PAGE_BOTTOM_PADDING;
  const [background, muted, accent] = useThemeColor([
    'background',
    'muted',
    'accent',
  ]);
  const queryClient = useQueryClient();
  const [activeMailbox, setActiveMailbox] = useState<MailboxKind>('inbox');
  const [replyTarget, setReplyTarget] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [retryText, setRetryText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    messageId: string;
    displayName: string;
  } | null>(null);
  const directMessageMutation = useDirectMessageMutation();
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      updatePullScrollY(event.contentOffset.y);
    },
  });
  useScrollToTop(inboxListRef);
  useScrollToTop(outboxListRef);
  const parentNavigation =
    navigation.getParent<NavigationProp<AuthStackParamList>>();
  const { data, isLoading, error, refetch } = useQuery<MessageGroups>({
    queryKey: ['private-messages', userId],
    queryFn: async () => {
      const [inboxData, sentData] = await Promise.all([
        get('/direct_messages/inbox', {
          count: 40,
        }),
        get('/direct_messages/sent', {
          count: 40,
        }),
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
  const renderHeaderTabs = () => (
    <Tabs
      value={activeMailbox}
      onValueChange={v => setActiveMailbox(v as MailboxKind)}
      variant="primary"
    >
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="inbox">
          {({ isSelected }) => (
            <>
              <Inbox size={12} color={isSelected ? accent : muted} />
              <Tabs.Label>{t('messagesInbox')}</Tabs.Label>
            </>
          )}
        </Tabs.Trigger>
        <Tabs.Trigger value="outbox">
          {({ isSelected }) => (
            <>
              <Send size={12} color={isSelected ? accent : muted} />
              <Tabs.Label>{t('messagesOutbox')}</Tabs.Label>
            </>
          )}
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
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
        title: t('messagesTitle'),
        headerTitle: undefined,
        headerTitleAlign: undefined,
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: undefined,
      });
    };
  }, [parentNavigation, renderHeaderTabs, t, totalMailboxCount]);
  const errorMessage = error ? t('messagesLoadFailed') : null;
  const technicalError = error instanceof Error ? error.message : null;
  const readableInsets = useReadableContentInsets();
  const contentContainerStyle = {
    paddingHorizontal: Math.max(PAGE_HORIZONTAL_PADDING, readableInsets.left),
    paddingTop: Platform.OS === 'android' ? headerHeight : 0,
    paddingBottom: insets.bottom + PAGE_BOTTOM_PADDING,
    flexGrow: 1,
  };
  const handleDeleteMessage = (messageId: string) => {
    const previous = queryClient.getQueryData<MessageGroups>(['private-messages', userId]);
    queryClient.setQueryData<MessageGroups>(
      ['private-messages', userId],
      prev => {
        if (!prev) return prev;
        return {
          inbox: prev.inbox.filter(m => m.id !== messageId),
          outbox: prev.outbox.filter(m => m.id !== messageId),
        };
      },
    );
    post('/direct_messages/destroy', { id: messageId }).catch((deleteError: unknown) => {
      if (previous) {
        queryClient.setQueryData(['private-messages', userId], previous);
      }
      showVariantToast(
        'danger',
        t('messageDeleteFailed'),
        getErrorMessage(deleteError, t('messageDeleteFailedMessage')),
      );
    });
  };
  const handleSubmitReply = ({ text }: ComposerModalSubmitPayload) => {
    if (!replyTarget) {
      return;
    }
    const trimmedText = text.trim();
    if (!trimmedText) {
      showVariantToast(
        'danger',
        t('cannotSendMessageTitle'),
        t('messageNeedsContent'),
      );
      return;
    }
    const currentTarget = replyTarget;
    setReplyTarget(null);
    setRetryText('');
    showVariantToast('accent', t('composerSending'), '');
    directMessageMutation.mutateAsync({
      userId: currentTarget.userId,
      text: trimmedText,
    }).then(() => {
      showVariantToast('success', t('sentTitle'), t('profileMessageSent'));
      refetch().catch(() => undefined);
    }).catch((replyError: unknown) => {
      showVariantToast(
        'danger',
        t('messageReplyFailed'),
        getErrorMessage(replyError, t('messageReplyFailedMessage')),
      );
      setRetryText(trimmedText);
      setReplyTarget(currentTarget);
    });
  };
  const handleOpenProfile = (targetUserId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId: targetUserId,
      },
    });
  };
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
          renderItem={({ item, index }) => {
            const sender = item.sender;
            const senderId = sender?.id || item.sender_id;
            const counterpart = mailbox === 'inbox' ? item.sender : item.recipient;
            const counterpartId = counterpart?.id || (mailbox === 'inbox' ? item.sender_id : item.recipient_id);
            const counterpartName = counterpart?.screen_name || counterpart?.name || counterpartId || '';
            return (
              <MessageCard
                message={item}
                mailbox={mailbox}
                shadowType={CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length]}
                onPressProfile={handleOpenProfile}
                onDelete={() => setDeleteTarget({ messageId: item.id, displayName: counterpartName })}
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
              />
            );
          }}
          onScroll={scrollHandler}
          contentInsetAdjustmentBehavior="automatic"
          scrollIndicatorInsets={{
            bottom: insets.bottom,
          }}
          contentContainerStyle={contentContainerStyle}
          refreshControl={createRefreshControl()}
          ListHeaderComponent={
            errorMessage && mailboxItems.length > 0 ? (
              <ErrorBanner message={errorMessage} technicalDetail={technicalError} />
            ) : null
          }
          ListHeaderComponentStyle={
            errorMessage && mailboxItems.length > 0
              ? {
                marginBottom: CARD_GAP,
              }
              : undefined
          }
          ItemSeparatorComponent={MessageItemSeparator}
          ListEmptyComponent={
            errorMessage ? (
              <TimelineEmptyPlaceholder icon={AlertCircle} message={errorMessage} detail={technicalError} tone="danger" />
            ) : isLoading ? (
              <View className="gap-4">
                {Array.from({
                  length: countSkeletonItemsForHeight(
                    skeletonAvailableHeight,
                    MESSAGE_SKELETON_ITEM_HEIGHT,
                    MESSAGE_SKELETON_GAP,
                    MESSAGE_SKELETON_FALLBACK_COUNT,
                  ),
                }).map((_, i) => (
                  <MessageSkeletonCard key={i} shimmerIndex={i % 3} colorIndex={i} />
                ))}
              </View>
            ) : (
              <TimelineEmptyMessage
                message={
                  mailbox === 'inbox'
                    ? t('messagesInboxEmpty')
                    : t('messagesOutboxEmpty')
                }
              />
            )
          }
        />
      </NativeEdgeScrollShadow>
      <NeobrutalRefreshIndicator
        refreshing={isPullRefreshing}
        scrollY={pullScrollY}
        safeAreaTop={safeAreaTop}
        scrollInsetTop={scrollInsetTop}
        pullThreshold={COMPACT_PULL_THRESHOLD}
      />
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
        title={
          replyTarget
            ? t('messageReplyComposerTitle', {
              name: replyTarget.displayName,
            })
            : ''
        }
        placeholder={t('messageReplyPlaceholder')}
        submitLabel={t('messageSend')}
        initialText={retryText}
        resetKey={replyTarget ? `dm-reply:${replyTarget.userId}` : ''}
        isSubmitting={false}
        onCancel={() => { setReplyTarget(null); setRetryText(''); }}
        onSubmit={handleSubmitReply}
      />

      <Dialog isOpen={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/80" />
          <Dialog.Content className="w-[92%] max-w-[360px] self-center">
            <View className="mb-5 gap-1.5">
              <Dialog.Title>{t('messageDeleteTitle')}</Dialog.Title>
              <Dialog.Description>
                {deleteTarget
                  ? t('messageDeleteConfirm', { name: deleteTarget.displayName })
                  : ''}
              </Dialog.Description>
            </View>
            <View className="flex-row justify-end gap-3">
              <Button variant="ghost" size="sm" onPress={() => setDeleteTarget(null)}>
                {t('messageDeleteCancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={() => {
                  if (deleteTarget) {
                    handleDeleteMessage(deleteTarget.messageId);
                  }
                  setDeleteTarget(null);
                }}
              >
                {t('messageDeleteConfirmButton')}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
};
const PrivateMessagesRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const accessToken = auth.accessToken;
  if (!accessToken) {
    return (
      <View className="flex-1 bg-background">
        <TimelineEmptyPlaceholder
          icon={UserX}
          message={t('notLoggedIn')}
          tone="danger"
        />
      </View>
    );
  }
  return <PrivateMessagesContent userId={accessToken.userId} />;
};
export default PrivateMessagesRoute;
