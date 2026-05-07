import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { Dialog } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/app-text';
import { addHiddenStatus } from '@/settings/hidden-statuses';
import { filterHiddenStatusFromCaches } from '@/query/status-query-invalidation';
import { showVariantToast } from '@/utils/toast-alert';
import type { TranslationKey } from '@/i18n/translation-data';
import type { FanfouStatus } from '@/types/fanfou';

type Listener = () => void;

let currentTarget: FanfouStatus | null = null;
const listeners = new Set<Listener>();

const emitChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

const subscribeToReportTarget = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getReportTargetSnapshot = (): FanfouStatus | null => currentTarget;

export const openReportSheet = (status: FanfouStatus) => {
  currentTarget = status;
  emitChange();
};

const closeReportSheet = () => {
  currentTarget = null;
  emitChange();
};

type ReportReason = {
  id: string;
  labelKey: TranslationKey;
};

const REPORT_REASONS: ReadonlyArray<ReportReason> = [
  { id: 'spam', labelKey: 'reportReasonSpam' },
  { id: 'harassment', labelKey: 'reportReasonHarassment' },
  { id: 'hate', labelKey: 'reportReasonHate' },
  { id: 'sexual', labelKey: 'reportReasonSexual' },
  { id: 'violence', labelKey: 'reportReasonViolence' },
  { id: 'other', labelKey: 'reportReasonOther' },
];

const ReportStatusSheet = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const target = useSyncExternalStore(
    subscribeToReportTarget,
    getReportTargetSnapshot,
    getReportTargetSnapshot,
  );
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setSelectedReason(null);
    }
  }, [target]);

  const handleSubmit = () => {
    if (!target || !selectedReason) {
      return;
    }
    const statusId = target.id;
    addHiddenStatus(statusId);
    filterHiddenStatusFromCaches(queryClient, statusId);
    closeReportSheet();
    showVariantToast('success', t('reportSentTitle'), t('reportSentMessage'));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeReportSheet();
    }
  };

  return (
    <Dialog isOpen={target !== null} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-[92%] max-w-[360px] self-center gap-4 p-6">
          <Dialog.Title>{t('reportSheetTitle')}</Dialog.Title>
          <Dialog.Description>{t('reportSheetDescription')}</Dialog.Description>
          <View className="gap-2">
            {REPORT_REASONS.map(reason => {
              const isSelected = selectedReason === reason.id;
              return (
                <Pressable
                  key={reason.id}
                  onPress={() => setSelectedReason(reason.id)}
                  className={
                    'rounded-2xl px-4 py-3 ' +
                    (isSelected ? 'bg-accent' : 'bg-surface-secondary')
                  }
                >
                  <Text
                    className={
                      'text-[15px] ' +
                      (isSelected
                        ? 'font-semibold text-accent-foreground'
                        : 'text-foreground')
                    }
                  >
                    {t(reason.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="gap-3 pt-1">
            <Pressable
              onPress={selectedReason ? handleSubmit : undefined}
              disabled={!selectedReason}
              className="w-full items-center rounded-full bg-accent py-3"
              style={selectedReason ? undefined : [{ opacity: 0.5 }]}
            >
              <Text className="text-[15px] font-bold text-accent-foreground">
                {t('reportSubmit')}
              </Text>
            </Pressable>
            <Pressable
              onPress={closeReportSheet}
              className="w-full items-center rounded-full border border-muted py-3"
            >
              <Text className="text-[15px] font-semibold text-muted">
                {t('reportCancel')}
              </Text>
            </Pressable>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ReportStatusSheet;
