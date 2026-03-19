import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { Surface } from 'heroui-native';

import { Text } from '@/components/app-text';
import { ShimmerBar } from '@/components/timeline-skeleton-card';

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
  skeleton?: boolean;
  panelStyle?: StyleProp<ViewStyle>;
  primaryTextStyle?: StyleProp<TextStyle>;
  mutedTextStyle?: StyleProp<TextStyle>;
  linkTextStyle?: StyleProp<TextStyle>;
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
  skeleton,
  panelStyle,
  primaryTextStyle,
  mutedTextStyle,
  linkTextStyle,
}: ProfileSummaryCardProps) => {
  const normalizedLocation = normalizeText(location);
  const normalizedJoinedAt = normalizeText(joinedAt);
  const normalizedProfileUrl = normalizeText(profileUrl);
  const normalizedDescription = normalizeText(description);

  return (
    <Surface className="rounded-[24px] bg-accent/10 px-5 py-6" style={panelStyle}>
      <View className="flex-row items-start gap-5">
        {avatar}
        <View className="flex-1 gap-2">
          {skeleton ? (
            <>
              <ShimmerBar className="h-6 w-32 bg-surface-tertiary" isActive />
              <ShimmerBar
                className="h-3.5 w-24 bg-surface-tertiary"
                isActive={false}
              />
              <ShimmerBar
                className="h-3 w-16 bg-surface-tertiary"
                isActive={false}
              />
            </>
          ) : (
            <>
              <Text
                className="text-[22px] leading-[28px] text-foreground"
                style={primaryTextStyle}
              >
                {displayName}
              </Text>
              {handleName ? (
                <Text className="text-[14px] text-muted" style={mutedTextStyle}>
                  {handleName}
                </Text>
              ) : null}
              {normalizedLocation ? (
                <Text className="text-[13px] text-muted" style={mutedTextStyle}>
                  {normalizedLocation}
                </Text>
              ) : null}
              {normalizedJoinedAt ? (
                <Text className="text-[12px] text-muted" style={mutedTextStyle}>
                  Joined {normalizedJoinedAt}
                </Text>
              ) : null}
            </>
          )}
        </View>
        {rightSlot}
      </View>

      {!skeleton && normalizedProfileUrl ? (
        <Text className="mt-4 text-[13px] text-accent" style={linkTextStyle}>
          {normalizedProfileUrl}
        </Text>
      ) : null}

      {!skeleton && normalizedDescription ? (
        <Text
          className="mt-4 text-[14px] leading-6 text-foreground"
          style={primaryTextStyle}
        >
          {normalizedDescription}
        </Text>
      ) : null}

      {footer}
    </Surface>
  );
};

export default ProfileSummaryCard;
