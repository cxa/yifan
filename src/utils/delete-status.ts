import { post } from '@/auth/fanfou-client';
import type { FanfouStatus } from '@/types/fanfou';
import { showToastAlert } from '@/utils/toast-alert';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type DeleteStatusParams = {
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
  statusId,
  t,
  onDeleted,
}: DeleteStatusParams) => {
  try {
    await post('/statuses/destroy', {
      id: statusId,
    });
    await onDeleted();
    showToastAlert(t('successTitle'), t('statusDeleteSuccess'), undefined, {
      variant: 'success',
    });
  } catch (deleteError) {
    showToastAlert(
      t('statusDeleteFailedTitle'),
      getErrorMessage(deleteError, t('statusDeleteFailedMessage')),
      undefined,
      {
        variant: 'danger',
      },
    );
  }
};
