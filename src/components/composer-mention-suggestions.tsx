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
import type { IndexedUser } from '@/query/user-query-options';

type Props = {
  suggestions: (FanfouUser | IndexedUser)[];
  needle: string;
  isSearching: boolean;
  onSelect: (user: FanfouUser) => void;
};

// Highlight a direct ASCII/CJK substring match (used for the login ID).
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

// Highlight the display name: tries direct substring first, then falls back
// to pinyin-syllable boundary matching for CJK names (e.g. "guo" → bold "郭").
const highlightDisplayName = (
  text: string,
  needle: string,
  user: FanfouUser | IndexedUser,
): React.ReactNode => {
  if (!needle) return text;

  // Direct substring match (covers CJK character input like "小").
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(needle.toLowerCase());
  if (idx !== -1) {
    return (
      <>
        {text.slice(0, idx)}
        <Text className="font-semibold text-primary">
          {text.slice(idx, idx + needle.length)}
        </Text>
        {text.slice(idx + needle.length)}
      </>
    );
  }

  // Pinyin match: find which syllable boundary the needle starts at, then
  // count how many syllables it spans to determine the character range.
  if ('_pinyinSuffixes' in user && user._pinyinSuffixes.length > 0) {
    const { _pinyinSuffixes: suffixes, _pinyinSyllables: syllables } = user;
    for (let startIdx = 0; startIdx < suffixes.length; startIdx++) {
      if (suffixes[startIdx].startsWith(needle)) {
        let consumed = 0;
        let count = 0;
        for (let i = startIdx; consumed < needle.length && i < syllables.length; i++) {
          consumed += syllables[i].length;
          count++;
        }
        const endIdx = startIdx + count;
        if (endIdx > startIdx && endIdx <= text.length) {
          return (
            <>
              {text.slice(0, startIdx)}
              <Text className="font-semibold text-primary">
                {text.slice(startIdx, endIdx)}
              </Text>
              {text.slice(endIdx)}
            </>
          );
        }
        break;
      }
    }
  }

  return text;
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
        className="bg-background"
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
                {highlightDisplayName(displayName, needle, user)}
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
