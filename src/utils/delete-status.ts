import type { QueryClient } from '@tanstack/react-query';
import { post } from '@/auth/fanfou-client';
import type { FanfouStatus } from '@/types/fanfou';
import { invalidateStatusRelatedQueries } from '@/query/status-query-invalidation';
import { showVariantToast } from '@/utils/toast-alert';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type DeleteStatusParams = {
  queryClient: QueryClient;
  statusId: string;
  t: TranslateFn;
  onDeleted: () => void | Promise<void>;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const isStatusOwnedByUser = (
  status: FanfouStatus,
  authUserId: string | null | undefined,
) => {
  if (!authUserId) {
    return false;
  }
  return (
    status.user.id.trim().toLowerCase() === authUserId.trim().toLowerCase()
  );
};

export const deleteStatus = async ({
  queryClient,
  statusId,
  t,
  onDeleted,
}: DeleteStatusParams) => {
  try {
    await post('/statuses/destroy', {
      id: statusId,
    });
    await onDeleted();
    await invalidateStatusRelatedQueries(queryClient);
    showVariantToast('success', t('successTitle'), t('statusDeleteSuccess'));
  } catch (deleteError) {
    showVariantToast(
      'danger',
      t('statusDeleteFailedTitle'),
      getErrorMessage(deleteError, t('statusDeleteFailedMessage')),
    );
  }
};
