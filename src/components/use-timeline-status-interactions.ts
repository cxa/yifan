import { useRef, useState } from 'react';
import { showToastAlert } from '@/utils/toast-alert';
import { Image, View, useWindowDimensions } from 'react-native';
import { post, uploadPhoto } from '@/auth/fanfou-client';
import type { ComposerModalSubmitPayload } from '@/components/composer-modal';
import type { FanfouStatus } from '@/types/fanfou';
import { shouldUsePhotoSharedTransition } from '@/components/photo-viewer-shared-transition';
type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ComposerMode = 'reply' | 'repost' | null;
type ReplyTarget = {
  statusId: string;
  userId: string;
  screenName: string;
};
type RepostTarget = {
  statusId: string;
  screenName: string;
};
type UseTimelineStatusInteractionsParams = {
  updateStatusById: (
    statusId: string,
    updater: (status: FanfouStatus) => FanfouStatus,
  ) => void;
  topInset: number;
  bottomOccludedHeight?: number;
  scrollShadowSize: number;
};
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const useTimelineStatusInteractions = ({
  updateStatusById,
  topInset,
  bottomOccludedHeight = 0,
  scrollShadowSize,
}: UseTimelineStatusInteractionsParams) => {
  const { height: viewportHeight } = useWindowDimensions();
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
  const [composeMode, setComposeMode] = useState<ComposerMode>(null);
  const [composeReplyTarget, setComposeReplyTarget] =
    useState<ReplyTarget | null>(null);
  const [composeRepostTarget, setComposeRepostTarget] =
    useState<RepostTarget | null>(null);
  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(
    () => new Set(),
  );
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
    const useSharedTransition = shouldUsePhotoSharedTransition({
      originRect,
      viewportHeight,
      topInset,
      bottomOccludedHeight,
      scrollShadowSize,
    });
    Image.prefetch(photoUrl).catch(() => undefined);
    setPhotoViewerPreviewKey(useSharedTransition ? previewKey : null);
    setPhotoViewerOriginRect(useSharedTransition ? originRect : null);
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
    setComposeRepostTarget({
      statusId: status.id,
      screenName,
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
        showToastAlert('Cannot reply', 'Missing reply target.');
        return;
      }
      if (!trimmedText && !hasPhoto) {
        showToastAlert('Cannot reply', 'Please enter text or attach a photo.');
        return;
      }
    }
    if (composeMode === 'repost' && !composeRepostTarget) {
      showToastAlert('Cannot repost', 'Missing repost target.');
      return;
    }
    try {
      if (composeMode === 'reply' && composeReplyTarget) {
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
      }
      if (composeMode === 'repost' && composeRepostTarget) {
        await post('/statuses/update', {
          status: trimmedText || undefined,
          repost_status_id: composeRepostTarget.statusId,
        });
      }
      setComposeMode(null);
      setComposeReplyTarget(null);
      setComposeRepostTarget(null);
      showToastAlert(
        'Sent',
        composeMode === 'reply' ? 'Reply posted.' : 'Reposted.',
      );
    } catch (requestError) {
      showToastAlert(
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
      showToastAlert(
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
    pendingBookmarkIds,
    photoViewerUrl,
    photoViewerVisible,
    photoViewerPreviewKey,
    photoViewerOriginRect,
    registerPhotoPreviewRef,
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
