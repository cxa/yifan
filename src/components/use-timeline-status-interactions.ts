import { useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import { buildRepostStatus, executeComposerSend, toPlainText } from '@/utils/composer-send';
import type { StatusUpdateMutationVariables } from '@/query/post-mutations';
import { Image } from 'react-native';
import { post } from '@/auth/fanfou-client';
import type { ComposerModalSubmitPayload } from '@/components/composer-modal';
import type { FanfouStatus } from '@/types/fanfou';
import { useStatusUpdateMutation } from '@/query/post-mutations';
import type { PhotoViewerOriginRect } from '@/components/photo-viewer-shared-transition';
type ComposerMode = 'reply' | 'repost' | null;
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


type UseTimelineStatusInteractionsParams = {
  updateStatusById: (
    statusId: string,
    updater: (status: FanfouStatus) => FanfouStatus,
  ) => void;
};
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const useTimelineStatusInteractions = ({
  updateStatusById,
}: UseTimelineStatusInteractionsParams) => {
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerOriginRect, setPhotoViewerOriginRect] = useState<PhotoViewerOriginRect | null>(null);
  const [composeMode, setComposeMode] = useState<ComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);
  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const statusUpdateMutation = useStatusUpdateMutation();
  const handlePhotoPress = (photoUrl: string, originRect: PhotoViewerOriginRect | null) => {
    Image.prefetch(photoUrl).catch(() => undefined);
    setPhotoViewerOriginRect(originRect);
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
  const handleOpenReplyComposer = (status: FanfouStatus) => {
    const userId = status.user.id;
    const screenName = status.user.screen_name || status.user.id;
    setComposeReplyTarget({
      statusId: status.id,
      userId,
      screenName,
    });
    setComposeRepostTarget(null);
    setComposeMode('reply');
  };
  const handleOpenRepostComposer = (status: FanfouStatus) => {
    const screenName = status.user.screen_name || status.user.id;
    const plainText = toPlainText(status.text);
    setComposeRepostTarget({
      statusId: status.id,
      screenName,
      plainText,
    });
    setComposeReplyTarget(null);
    setComposeMode('repost');
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
    if (!composeMode) return;
    const trimmedText = text.trim();
    const hasPhoto = Boolean(photo?.base64);

    // Validate — keep composer open on error
    if (composeMode === 'reply') {
      if (!composeReplyTarget) {
        showVariantToast('danger', '无法回复', '缺少回复目标。');
        return;
      }
      if (!trimmedText && !hasPhoto) {
        showVariantToast('danger', '无法回复', '请输入文字或附上图片。');
        return;
      }
    }
    if (composeMode === 'repost' && !composeRepostTarget) {
      showVariantToast('danger', '无法转发', '缺少转发目标。');
      return;
    }

    // Build payload before closing composer
    let sendFn: () => Promise<unknown>;
    let failedTitle: string;
    if (composeMode === 'reply' && composeReplyTarget) {
      const payload: StatusUpdateMutationVariables = {
        status: photo?.base64 ? trimmedText || undefined : trimmedText,
        photoBase64: photo?.base64,
        params: {
          in_reply_to_status_id: composeReplyTarget.statusId,
          in_reply_to_user_id: composeReplyTarget.userId,
        },
      };
      sendFn = () => statusUpdateMutation.mutateAsync(payload);
      failedTitle = '回复失败';
    } else if (composeMode === 'repost' && composeRepostTarget) {
      const payload: StatusUpdateMutationVariables = {
        status: buildRepostStatus(trimmedText, composeRepostTarget.screenName, composeRepostTarget.plainText),
        params: { repost_status_id: composeRepostTarget.statusId },
      };
      sendFn = () => statusUpdateMutation.mutateAsync(payload);
      failedTitle = '转发失败';
    } else {
      return;
    }

    // Close composer immediately, then send in background
    setComposeMode(null);
    setComposeReplyTarget(null);
    setComposeRepostTarget(null);
    executeComposerSend(sendFn, failedTitle);
  };
  const handleToggleBookmark = async (status: FanfouStatus) => {
    const statusId = status.id;
    if (pendingBookmarkIds.has(statusId)) {
      return;
    }
    const nextFavorited = !status.favorited;
    setBookmarkPending(statusId, true);
    updateStatusById(statusId, item => ({
      ...item,
      favorited: nextFavorited,
    }));
    try {
      await post(nextFavorited ? '/favorites/create' : '/favorites/destroy', {
        id: statusId,
      });
    } catch (requestError) {
      updateStatusById(statusId, item => ({
        ...item,
        favorited: !nextFavorited,
      }));
      showVariantToast(
        'danger',
        'Bookmark failed',
        getErrorMessage(requestError, 'Please try again.'),
      );
    } finally {
      setBookmarkPending(statusId, false);
    }
  };
  const composerTitle =
    composeMode === 'reply'
      ? composeReplyTarget
        ? `Reply @${composeReplyTarget.screenName}`
        : 'Reply'
      : composeMode === 'repost'
      ? composeRepostTarget?.screenName
        ? `Repost @${composeRepostTarget.screenName}`
        : 'Repost'
      : 'Compose';
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
  return {
    composeMode,
    composerTitle,
    composerPlaceholder,
    composerSubmitLabel,
    composerInitialText,
    composerResetKey,
    isComposerSubmitting: statusUpdateMutation.isPending,
    pendingBookmarkIds,
    photoViewerUrl,
    photoViewerVisible,
    photoViewerOriginRect,
    handlePhotoPress,
    handleClosePhotoViewer,
    handleOpenReplyComposer,
    handleOpenRepostComposer,
    handleCloseComposer,
    handleSendComposer,
    handleToggleBookmark,
  };
};
export default useTimelineStatusInteractions;
