import { hideToast, showProgressToast, showVariantToast } from '@/utils/toast-alert';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const executeComposerSend = (
  sendFn: () => Promise<unknown>,
  failedTitle: string,
): void => {
  const run = async () => {
    const toastId = showProgressToast('发送中…');
    try {
      await sendFn();
      hideToast(toastId);
    } catch (requestError) {
      hideToast(toastId);
      showVariantToast(
        'danger',
        failedTitle,
        getErrorMessage(requestError, '请重试。'),
        [{ text: '重试', onPress: () => run() }],
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
