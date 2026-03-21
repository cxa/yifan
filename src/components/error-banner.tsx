import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { Surface } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/app-text';

type ErrorBannerProps = {
  message: string;
  technicalDetail?: string | null;
};

const ErrorBanner = ({ message, technicalDetail }: ErrorBannerProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <Surface className="rounded-2xl bg-danger-soft px-4 py-3 gap-1">
      <Text className="text-[13px] text-danger-foreground">{message}</Text>
      {technicalDetail ? (
        <>
          <Pressable
            onPress={() => setExpanded(v => !v)}
            hitSlop={8}
            className="self-start active:opacity-60"
          >
            <Text className="text-[11px] text-danger-foreground/60 underline">
              {expanded ? t('errorHideDetails') : t('errorTechnicalDetails')}
            </Text>
          </Pressable>
          {expanded && (
            <Text className="text-[11px] text-danger-foreground/60 font-mono leading-relaxed">
              {technicalDetail}
            </Text>
          )}
        </>
      ) : null}
    </Surface>
  );
};

export default ErrorBanner;
