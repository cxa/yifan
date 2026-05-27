import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useThemeColor } from 'heroui-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/app-text';
import { normalizeFanfouImageUrl } from '@/utils/normalize-fanfou-image-url';
import type { FanfouUser } from '@/types/fanfou';

type Props = {
  suggestions: FanfouUser[];
  needle: string;
  isSearching: boolean;
  onSelect: (user: FanfouUser) => void;
};

const highlightMatch = (text: string, needle: string): React.ReactNode => {
  if (!needle) {
    return text;
  }
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(needle.toLowerCase());
  if (idx === -1) {
    return text;
  }
  return (
    <>
      {text.slice(0, idx)}
      <Text className="font-semibold text-primary">
        {text.slice(idx, idx + needle.length)}
      </Text>
      {text.slice(idx + needle.length)}
    </>
  );
};

const ComposerMentionSuggestions = ({
  suggestions,
  needle,
  isSearching,
  onSelect,
}: Props) => {
  const { t } = useTranslation();
  const [border] = useThemeColor(['border']);
  if (suggestions.length === 0 && !isSearching) {
    return null;
  }
  return (
    <View
      className="bg-background"
      style={[styles.container, { borderTopColor: border }]}
    >
      <Text className="px-4 py-2 text-[13px] text-muted">
        {t('mentionSuggestionsHint')}
      </Text>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {suggestions.map(user => {
          const avatarUrl = normalizeFanfouImageUrl(user.profile_image_url);
          // On Fanfou: id = login handle, screen_name/name = display name,
          // unique_id = opaque internal ID (not the @handle).
          const displayName = user.name || user.screen_name || user.id;
          const loginId = user.id;
          return (
            <Pressable
              key={user.id}
              onPress={() => onSelect(user)}
              accessibilityRole="button"
              accessibilityLabel={`@${loginId}`}
              className="flex-row items-center gap-3 px-4 py-2 active:bg-surface-secondary"
            >
              <Image
                source={avatarUrl ? { uri: avatarUrl } : undefined}
                className="size-9 rounded-full bg-surface-secondary"
              />
              <Text
                className="flex-1 text-[14px] text-foreground"
                numberOfLines={1}
              >
                {highlightMatch(displayName, needle)}
                {' ('}
                {highlightMatch(loginId, needle)}
                {')'}
              </Text>
            </Pressable>
          );
        })}
        {isSearching && suggestions.length === 0 && (
          <View className="items-center py-4">
            <ActivityIndicator size="small" />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    maxHeight: 264,
  },
});

export default ComposerMentionSuggestions;
