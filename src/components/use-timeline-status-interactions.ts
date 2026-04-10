import { useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
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
  statusText: string;
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
    const statusText = status.text.replace(/<[^>]+>/g, '');
    setComposeRepostTarget({
      statusId: status.id,
      screenName,
      statusText,
    });
    setComposeReplyTarget(null);
    setComposeMode('repost');
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
    if (!composeMode) {
      return;
    }
    const trimmedText = text.trim();
    const hasPhoto = Boolean(photo?.base64);
    if (composeMode === 'reply') {
      if (!composeReplyTarget) {
        showVariantToast('danger', 'Cannot reply', 'Missing reply target.');
        return;
      }
      if (!trimmedText && !hasPhoto) {
        showVariantToast(
          'danger',
          'Cannot reply',
          'Please enter text or attach a photo.',
        );
        return;
      }
    }
    if (composeMode === 'repost' && !composeRepostTarget) {
      showVariantToast('danger', 'Cannot repost', 'Missing repost target.');
      return;
    }
    try {
      if (composeMode === 'reply' && composeReplyTarget) {
        await statusUpdateMutation.mutateAsync({
          status: photo?.base64 ? trimmedText || undefined : trimmedText,
          photoBase64: photo?.base64,
          params: {
            in_reply_to_status_id: composeReplyTarget.statusId,
            in_reply_to_user_id: composeReplyTarget.userId,
          },
        });
      }
      if (composeMode === 'repost' && composeRepostTarget) {
        const repostSuffix = `转@${composeRepostTarget.screenName}: ${composeRepostTarget.statusText}`;
        const repostStatus = trimmedText ? `${trimmedText} ${repostSuffix}` : repostSuffix;
        await statusUpdateMutation.mutateAsync({
          status: repostStatus,
          params: {
            repost_status_id: composeRepostTarget.statusId,
          },
        });
      }
      setComposeMode(null);
      setComposeReplyTarget(null);
      setComposeRepostTarget(null);
      showVariantToast(
        'success',
        'Sent',
        composeMode === 'reply' ? 'Reply posted.' : 'Reposted.',
      );
    } catch (requestError) {
      showVariantToast(
        'danger',
        composeMode === 'reply' ? 'Reply failed' : 'Repost failed',
        getErrorMessage(requestError, 'Please try again.'),
      );
    }
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
