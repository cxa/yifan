import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/app-text';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColor } from 'heroui-native';

type TimelineEmptyPlaceholderProps = {
  icon: LucideIcon;
  message: string;
  detail?: string | null;
  compact?: boolean;
  tone?: 'muted' | 'danger';
};

const TimelineEmptyPlaceholder = ({
  icon: Icon,
  message,
  detail,
  compact = false,
  tone = 'muted',
}: TimelineEmptyPlaceholderProps) => {
  const [muted, danger] = useThemeColor(['muted', 'danger']);
  const { height } = useWindowDimensions();
  const iconColor = tone === 'danger' ? danger : muted;
  const textColorClass = tone === 'danger' ? 'text-danger' : 'text-muted';
  const trimmedDetail = detail?.trim() || null;
  const normalizedDetail =
    trimmedDetail && trimmedDetail !== message.trim() ? trimmedDetail : null;

  if (compact) {
    return (
      <View className="items-center py-6 px-4">
        <Icon size={32} color={iconColor} strokeWidth={1.5} />
        <Text className={`mt-2 text-[13px] text-center ${textColorClass}`}>
          {message}
        </Text>
        {normalizedDetail ? (
          <Text
            className={`mt-1 text-[11px] text-center ${textColorClass} opacity-60`}
          >
            {normalizedDetail}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className="items-center justify-center px-6"
      style={{ minHeight: height * 0.55 }}
    >
      <Icon size={48} color={iconColor} strokeWidth={1.5} />
      <Text className={`mt-4 text-[15px] text-center ${textColorClass}`}>
        {message}
      </Text>
      {normalizedDetail ? (
        <Text
          className={`mt-2 text-[12px] text-center ${textColorClass} opacity-60`}
        >
          {normalizedDetail}
        </Text>
      ) : null}
    </View>
  );
};

export default TimelineEmptyPlaceholder;
