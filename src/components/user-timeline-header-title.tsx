import React from 'react';
import { Image, View } from 'react-native';

import { Text } from '@/components/app-text';

const HEADER_AVATAR_SIZE = 26;

type UserTimelineHeaderTitleProps = {
  displayName: string;
  handleName: string;
  avatarUrl: string | null;
  avatarInitial: string;
};

const UserTimelineHeaderTitle = ({
  displayName,
  handleName,
  avatarUrl,
  avatarInitial,
}: UserTimelineHeaderTitleProps) => (
  <View className="flex-row items-center justify-center gap-3">
    <View className="min-w-0 flex-row items-center gap-2 shrink">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="rounded-full bg-surface-secondary"
          style={{ width: HEADER_AVATAR_SIZE, height: HEADER_AVATAR_SIZE }}
        />
      ) : (
        <View
          className="items-center justify-center rounded-full bg-surface-secondary"
          style={{ width: HEADER_AVATAR_SIZE, height: HEADER_AVATAR_SIZE }}
        >
          <Text className="text-[11px] text-muted">{avatarInitial}</Text>
        </View>
      )}
      <View className="min-w-0 items-start shrink">
        <Text
          className="shrink text-[13px] leading-4 text-foreground"
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          className="shrink text-[13px] leading-4 text-muted"
          numberOfLines={1}
        >
          {handleName}
        </Text>
      </View>
    </View>
  </View>
);

export default UserTimelineHeaderTitle;
