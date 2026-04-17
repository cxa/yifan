import React, { useEffect, useRef, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import {
  Image,
  Platform,
  RefreshControl,
  View,
  useWindowDimensions,
} from 'react-native';
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
import { useThemeColor } from 'heroui-native';
import ErrorBanner from '@/components/error-banner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthSession } from '@/auth/auth-session';
import { get, post } from '@/auth/fanfou-client';
import { Text } from '@/components/app-text';
import ComposerModal from '@/components/composer-modal';
import { deleteStatus, isStatusOwnedByUser } from '@/utils/delete-status';
import useTimelineStatusInteractions from '@/components/use-timeline-status-interactions';
import {
  CARD_PASTEL_CYCLE,
  type DropShadowBoxType,
} from '@/components/drop-shadow-box';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import PhotoViewerModal from '@/components/photo-viewer-modal';
import type { PhotoViewerOriginRect } from '@/components/photo-viewer-shared-transition';
import TimelineStatusCard from '@/components/timeline-status-card';
import {
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
} from '@/navigation/route-names';
import TimelineSkeletonList from '@/components/timeline-skeleton-list';
import {
  TIMELINE_HORIZONTAL_PADDING,
  TIMELINE_SPACING,
} from '@/components/timeline-list-settings';
import { useReadableContentInsets } from '@/navigation/readable-content-guide';
import type {
  AuthStackParamList,
  AuthStatusStackParamList,
} from '@/navigation/types';
import type { FanfouStatus } from '@/types/fanfou';
import { parseFanfouDate } from '@/utils/fanfou-date';
const STATUS_THREAD_CARD_GAP = 8;
const STATUS_THREAD_STACK_STYLE = { gap: STATUS_THREAD_CARD_GAP } as const;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const normalizeStatus = (value: unknown): FanfouStatus | null =>
  isRecord(value) ? (value as FanfouStatus) : null;
const normalizeTimelineItems = (value: unknown): FanfouStatus[] =>
  Array.isArray(value) ? (value as FanfouStatus[]) : [];
const getStatusId = (status: FanfouStatus): string => status.id;
const getStatusCreatedAtMs = (status: FanfouStatus) => {
  const parsed = parseFanfouDate(status.created_at);
  if (parsed) {
    return parsed.getTime();
  }
  const fallback = new Date(status.created_at);
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
};
const mergeConversationStatuses = (
  contextItems: FanfouStatus[],
  status: FanfouStatus | null,
) => {
  const dedupedById = new Map<string, FanfouStatus>();
  for (const item of contextItems) {
    dedupedById.set(getStatusId(item), item);
  }
  if (status) {
    dedupedById.set(getStatusId(status), status);
  }
  return Array.from(dedupedById.values()).sort((left, right) => {
    return getStatusCreatedAtMs(left) - getStatusCreatedAtMs(right);
  });
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
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const authUserId = auth.accessToken?.userId ?? null;
  const route =
    useRoute<
      RouteProp<AuthStatusStackParamList, typeof AUTH_STATUS_ROUTE.DETAIL>
    >();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const routeStatusId = route.params.statusId.trim();
  const routeShadowType: DropShadowBoxType = route.params.shadowType ?? 'accent';
  const { t } = useTranslation();
  const { pullScrollY, safeAreaTop, scrollInsetTop, updatePullScrollY } =
    usePullScrollY();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      updatePullScrollY(event.contentOffset.y);
    },
  });
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerOriginRect, setPhotoViewerOriginRect] = useState<PhotoViewerOriginRect | null>(null);
  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoritedOverrides, setFavoritedOverrides] = useState<
    Record<string, boolean>
  >({});
  const {
    composeMode,
    composerTitle,
    composerPlaceholder,
    composerSubmitLabel,
    composerInitialText,
    composerResetKey,
    composerQuotedStatus,
    isComposerSubmitting,
    handleOpenReplyComposer,
    handleOpenRepostComposer,
    handleCloseComposer,
    handleSendComposer,
  } = useTimelineStatusInteractions();
  const statusQueryKey = ['status', 'detail', routeStatusId] as const;
  const contextQueryKey = ['status', 'context', routeStatusId] as const;
  const {
    data: status,
    isLoading: isStatusLoading,
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
  const contextItems = contextStatuses ?? [];
  const conversationItems = mergeConversationStatuses(
    contextItems,
    status ?? null,
  );
  const mainStatus = (() => {
    const fromConversation = conversationItems.find(
      item => getStatusId(item) === routeStatusId,
    );
    return fromConversation ?? status;
  })();
  const mainStatusId = mainStatus ? getStatusId(mainStatus) : routeStatusId;
  const { beforeStatuses, afterStatuses } = (() => {
    if (conversationItems.length === 0) {
      return {
        beforeStatuses: [] as FanfouStatus[],
        afterStatuses: [] as FanfouStatus[],
      };
    }
    const pivotIndex = conversationItems.findIndex(
      item => getStatusId(item) === mainStatusId,
    );
    if (pivotIndex === -1) {
      return {
        beforeStatuses: [] as FanfouStatus[],
        afterStatuses: conversationItems,
      };
    }
    return {
      beforeStatuses: conversationItems.slice(0, pivotIndex),
      afterStatuses: conversationItems.slice(pivotIndex + 1),
    };
  })();
  const statusErrorMessage = statusError
    ? getErrorMessage(statusError, t('statusLoadFailed'))
    : null;
  const statusTechnicalError = statusError instanceof Error ? statusError.message : null;
  const contextErrorMessage = contextError
    ? getErrorMessage(contextError, t('conversationLoadFailed'))
    : null;
  const contextTechnicalError = contextError instanceof Error ? contextError.message : null;
  const isHydratingStatus =
    !mainStatus && (isStatusLoading || isContextLoading);

  // Scroll main status into view when context loads and pushes it down.
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const [cardSectionTop, setCardSectionTop] = useState(0);
  const [mainCardTop, setMainCardTop] = useState<number | null>(null);
  const hasScrolledToMainRef = useRef(false);
  useEffect(() => {
    if (
      hasScrolledToMainRef.current ||
      mainCardTop === null ||
      beforeStatuses.length === 0 ||
      !scrollViewRef.current
    ) {
      return;
    }
    hasScrolledToMainRef.current = true;
    const scrollTarget = cardSectionTop + mainCardTop;
    const visibleHeight = viewportHeight - headerHeight - insets.bottom;
    if (scrollTarget < visibleHeight) {
      return;
    }
    (scrollViewRef.current as unknown as { scrollTo(o: { y: number; animated: boolean }): void })
      .scrollTo({ y: scrollTarget, animated: false });
  }, [cardSectionTop, mainCardTop, beforeStatuses.length, viewportHeight, headerHeight, insets.bottom]);

  const readableInsets = useReadableContentInsets();
  const contentContainerStyle = {
    paddingHorizontal: Math.max(TIMELINE_HORIZONTAL_PADDING, readableInsets.left),
    paddingTop: Platform.OS === 'android' ? headerHeight : 0,
    paddingBottom: insets.bottom + TIMELINE_SPACING,
    gap: STATUS_THREAD_CARD_GAP,
  };
  const handleRefresh = async () => {
    await Promise.all([refetchStatus(), refetchContext()]);
  };
  const { isPullRefreshing, handlePullRefresh } =
    usePullRefreshState(handleRefresh);
  const handleMentionPress = (userId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId,
      },
    });
  };
  const handleProfilePress = (userId: string) => {
    navigation.navigate(AUTH_STACK_ROUTE.PROFILE, {
      screen: AUTH_PROFILE_ROUTE.DETAIL,
      params: {
        userId,
      },
    });
  };
  const handleOpenStatusDetail = (statusId: string, shadowType: DropShadowBoxType) => {
    if (statusId === routeStatusId) {
      return;
    }
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
  const getIsFavorited = (statusItem: FanfouStatus) => {
    const override = favoritedOverrides[getStatusId(statusItem)];
    return override ?? statusItem.favorited;
  };
  const handleToggleBookmark = async (statusItem: FanfouStatus) => {
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
      showVariantToast(
        'danger',
        t('bookmarkFailedTitle'),
        getErrorMessage(requestError, t('retryMessage')),
      );
    } finally {
      setBookmarkPending(statusId, false);
    }
  };
  const handleDeleteStatus = (statusItem: FanfouStatus) => {
    const statusId = getStatusId(statusItem);
    return deleteStatus({
      queryClient,
      statusId,
      t,
      onDeleted: async () => {
        if (statusId === routeStatusId) {
          navigation.goBack();
          return;
        }
        await Promise.all([refetchStatus(), refetchContext()]);
      },
    });
  };
  const renderStatusCard = (
    statusItem: FanfouStatus,
    isMainStatus: boolean,
    index: number,
  ) => {
    const statusId = getStatusId(statusItem);
    const isFavorited = getIsFavorited(statusItem);
    const cardStatus =
      statusItem.favorited === isFavorited
        ? statusItem
        : {
          ...statusItem,
          favorited: isFavorited,
        };
    const cardShadowType = isMainStatus
      ? routeShadowType
      : CARD_PASTEL_CYCLE[index % CARD_PASTEL_CYCLE.length];
    return (
      <TimelineStatusCard
        key={`${statusId}-${isMainStatus ? 'main' : 'context'}`}
        status={cardStatus}
        accent={accent}
        muted={muted}
        shadowType={cardShadowType}
        invertColorScheme={isMainStatus}
        isBookmarkPending={pendingBookmarkIds.has(statusId)}
        onOpenPhoto={handlePhotoPress}
        onPressStatus={handleOpenStatusDetail}
        onPressProfile={handleProfilePress}
        onPressMention={handleMentionPress}
        onPressTag={handleTagPress}
        onReply={handleOpenReplyComposer}
        onRepost={handleOpenRepostComposer}
        onToggleBookmark={handleToggleBookmark}
        canDelete={isStatusOwnedByUser(cardStatus, authUserId)}
        onDelete={handleDeleteStatus}
      />
    );
  };
  if (!routeStatusId) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <ErrorBanner message={t('statusMissingId')} />
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
          ref={scrollViewRef}
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
          {isHydratingStatus ? (
            <TimelineSkeletonList
              keyPrefix="status-detail-skeleton"
              count={1}
            />
          ) : null}

          {!mainStatus && !isStatusLoading && !isContextLoading ? (
            <View className="pb-2">
              <ErrorBanner message={statusErrorMessage ?? t('statusLoadFailed')} technicalDetail={statusTechnicalError} />
            </View>
          ) : null}

          {mainStatus ? (
            <View
              style={STATUS_THREAD_STACK_STYLE}
              onLayout={(e) => setCardSectionTop(e.nativeEvent.layout.y)}
            >
              {beforeStatuses.map((item, i) => renderStatusCard(item, false, i))}
              <View
                collapsable={false}
                onLayout={(e) => setMainCardTop(e.nativeEvent.layout.y)}
                style={{ marginBottom: STATUS_THREAD_CARD_GAP }}
              >
                {renderStatusCard(mainStatus, true, beforeStatuses.length)}
              </View>
              {afterStatuses.map((item, i) => renderStatusCard(item, false, beforeStatuses.length + 1 + i))}
            </View>
          ) : null}

          {contextErrorMessage && mainStatus ? (
            <ErrorBanner message={contextErrorMessage} technicalDetail={contextTechnicalError} />
          ) : null}

          {isContextLoading && mainStatus ? (
            <View className="items-center py-3 flex-row justify-center gap-2">
              <NeobrutalActivityIndicator size="small" />
              <Text className="text-[12px] text-muted">
                {t('conversationLoading')}
              </Text>
            </View>
          ) : null}
        </Animated.ScrollView>
        <PhotoViewerModal
          visible={photoViewerVisible}
          photoUrl={photoViewerUrl}
          onClose={handleClosePhotoViewer}
          originRect={photoViewerOriginRect}
        />
      </NativeEdgeScrollShadow>

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
        quotedStatus={composerQuotedStatus}
        enablePhoto={composeMode === 'reply'}
        allowEmptyText={composeMode === 'repost'}
        isSubmitting={isComposerSubmitting}
        onCancel={handleCloseComposer}
        onSubmit={handleSendComposer}
      />
    </>
  );
};
export default StatusDetailRoute;
