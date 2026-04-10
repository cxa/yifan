import i18n from 'i18next';
import { hideToast, showProgressToast, showVariantToast } from '@/utils/toast-alert';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const executeComposerSend = (
  sendFn: () => Promise<unknown>,
  failedTitle: string,
  onSuccess?: () => void,
): void => {
  const run = async () => {
    const toastId = showProgressToast(i18n.t('composerSending'));
    try {
      await sendFn();
      hideToast(toastId);
      onSuccess?.();
    } catch (requestError) {
      hideToast(toastId);
      showVariantToast(
        'danger',
        failedTitle,
        getErrorMessage(requestError, i18n.t('retryMessage')),
        [{ text: i18n.t('editProfileRetry'), onPress: () => run() }],
        { placement: 'top' },
      );
    }
  };
  run().catch(() => {});
};

export const toPlainText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

export const buildRepostStatus = (
  comment: string,
  screenName: string,
  plainText: string,
): string => {
  const repostBlock = `「转@${screenName}：${plainText}」`;
  return comment ? `${comment}\n${repostBlock}` : repostBlock;
};
