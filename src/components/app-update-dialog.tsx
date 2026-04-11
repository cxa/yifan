import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Dialog } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/app-text';
import {
  checkForUpdate,
  downloadAndApplyOTA,
  downloadAndInstall,
  openAppStore,
  setUpdateFoundListener,
  type UpdateInfo,
} from '@/services/app-updater';

const AppUpdateDialog = () => {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [hasError, setHasError] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    // Auto-check on launch (once, both platforms)
    if (!checked.current) {
      checked.current = true;
      checkForUpdate()
        .then(info => {
          if (info) {
            setUpdateInfo(info);
            setIsOpen(true);
          }
        })
        .catch(() => {});
    }
    // Manual trigger from settings "Check for Updates"
    setUpdateFoundListener(info => {
      setUpdateInfo(info);
      setIsOpen(true);
    });
    return () => setUpdateFoundListener(null);
  }, []);

  const handleNativeInstall = () => {
    if (!updateInfo || isDownloading) return;

    if (Platform.OS === 'ios') {
      openAppStore().catch(() => {});
      setIsOpen(false);
      return;
    }

    if (!updateInfo.apkUrl) return;
    setIsDownloading(true);
    setHasError(false);
    setPercent(0);
    downloadAndInstall(updateInfo.apkUrl, setPercent).catch(() => {
      setHasError(true);
      setIsDownloading(false);
    });
  };

  const handleOtaApply = () => {
    if (!updateInfo?.bundleUrl || isDownloading) return;
    setIsDownloading(true);
    setHasError(false);
    setPercent(0);
    // downloadAndApplyOTA restarts the app on success — no need to reset state
    downloadAndApplyOTA(updateInfo.bundleUrl, setPercent).catch(() => {
      setHasError(true);
      setIsDownloading(false);
    });
  };

  const handleDismiss = () => {
    if (isDownloading) return;
    setIsOpen(false);
  };

  if (!updateInfo) return null;

  const isOta = updateInfo.updateType === 'js';
  const isIosNative = updateInfo.updateType === 'native' && Platform.OS === 'ios';

  const primaryLabel = isOta
    ? t('updateOtaApply')
    : isIosNative
      ? t('updateOpenAppStore')
      : t('updateInstall');

  const primaryAction = isOta ? handleOtaApply : handleNativeInstall;

  const description = isOta
    ? t('updateOtaDescription', { version: updateInfo.version })
    : t('updateAvailableDescription', { version: updateInfo.version });

  return (
    <Dialog isOpen={isOpen} onOpenChange={open => { if (!open) handleDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-[92%] max-w-[360px] self-center gap-4 p-6">
          <Dialog.Title>{t('updateAvailableTitle')}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>

          {isDownloading && (
            <View className="gap-2">
              <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                <View
                  className="h-full rounded-full bg-accent"
                  style={[{ width: `${percent}%` }]}
                />
              </View>
              <Text className="text-center text-[13px] text-muted">
                {t('updateDownloading', { percent })}
              </Text>
            </View>
          )}

          {hasError && (
            <Text className="text-center text-[13px] text-danger">
              {t('updateDownloadError')}
            </Text>
          )}

          <View className="gap-3 pt-1">
            <Pressable
              onPress={isDownloading ? undefined : primaryAction}
              disabled={isDownloading}
              className="w-full items-center rounded-full bg-accent py-3"
              style={isDownloading ? [{ opacity: 0.5 }] : undefined}
            >
              <Text className="text-[15px] font-bold text-accent-foreground">
                {primaryLabel}
              </Text>
            </Pressable>
            {/* iOS native update: no dismiss — user should update */}
            {!isIosNative && (
              <Pressable
                onPress={handleDismiss}
                disabled={isDownloading}
                className="w-full items-center rounded-full border border-muted py-3"
              >
                <Text className="text-[15px] font-semibold text-muted">
                  {t('updateLater')}
                </Text>
              </Pressable>
            )}
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default AppUpdateDialog;
