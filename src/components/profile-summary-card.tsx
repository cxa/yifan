import React from 'react';
import { View } from 'react-native';
import { Surface } from 'heroui-native';

import { Text } from '@/components/app-text';

type ProfileSummaryCardProps = {
  avatar: React.ReactNode;
  displayName: string;
  handleName?: string | null;
  location?: string | null;
  joinedAt?: string | null;
  profileUrl?: string | null;
  description?: string | null;
  rightSlot?: React.ReactNode;
  footer?: React.ReactNode;
};

const normalizeText = (value?: string | null) => value?.trim() ?? '';

const ProfileSummaryCard = ({
  avatar,
  displayName,
  handleName,
  location,
  joinedAt,
  profileUrl,
  description,
  rightSlot,
  footer,
}: ProfileSummaryCardProps) => {
  const normalizedLocation = normalizeText(location);
  const normalizedJoinedAt = normalizeText(joinedAt);
  const normalizedProfileUrl = normalizeText(profileUrl);
  const normalizedDescription = normalizeText(description);

  return (
    <Surface className="bg-surface border-2 border-foreground dark:border-border px-5 py-6">
      <View className="flex-row items-start gap-5">
        {avatar}
        <View className="flex-1 gap-2">
          <Text className="text-[22px] leading-[28px] text-foreground">
            {displayName}
          </Text>
          {handleName ? (
            <Text className="text-[14px] text-muted">{handleName}</Text>
          ) : null}
          {normalizedLocation ? (
            <Text className="text-[13px] text-muted">{normalizedLocation}</Text>
          ) : null}
          {normalizedJoinedAt ? (
            <Text className="text-[12px] text-muted">
              Joined {normalizedJoinedAt}
            </Text>
          ) : null}
        </View>
        {rightSlot}
      </View>

      {normalizedProfileUrl ? (
        <Text className="mt-4 text-[13px] text-accent">
          {normalizedProfileUrl}
        </Text>
      ) : null}

      {normalizedDescription ? (
        <Text className="mt-4 text-[14px] leading-6 text-foreground">
          {normalizedDescription}
        </Text>
      ) : null}

      {footer}
    </Surface>
  );
};

export default ProfileSummaryCard;
