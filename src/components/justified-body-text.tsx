import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  UIManager,
  View,
  type NativeSyntheticEvent,
  type TextStyle,
} from 'react-native';
import { requireNativeComponent } from 'react-native';

import { Text as AppText } from '@/components/app-text';
import { openLink } from '@/utils/open-link';

// Shape mirrors parse-html's HtmlTextSegment but flattened for native bridging.
export type JustifiedBodySegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; screenName: string }
  | { type: 'tag'; text: string; tag: string }
  | { type: 'link'; text: string; href: string };

type JustifiedBodyTextProps = {
  segments: JustifiedBodySegment[];
  textColor: string;
  accentColor: string;
  activeTag?: string | null;
  tagActivePillClass?: string; // unused on native path; JS fallback uses it
  tagInactivePillClass?: string;
  tagActiveBackgroundColor?: string;
  tagInactiveBackgroundColor?: string;
  tagActiveTextColor?: string;
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  justify: boolean;
  onPressMention: (screenName: string) => void;
  onPressTag: (tag: string) => void;
  onPressText: () => void;
  renderPlainTextSegment: (text: string, key: string) => React.ReactNode;
};

type NativeEventShape<Payload> = (
  event: NativeSyntheticEvent<Payload>,
) => void;

type NativeProps = {
  segments: JustifiedBodySegment[];
  textColor: string;
  accentColor: string;
  tagActiveColor?: string;
  tagActiveBackgroundColor?: string;
  tagInactiveBackgroundColor?: string;
  activeTag?: string;
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  justify: boolean;
  onPressMention?: NativeEventShape<{ screenName: string }>;
  onPressTag?: NativeEventShape<{ tag: string }>;
  onPressLink?: NativeEventShape<{ href: string }>;
  onPressText?: NativeEventShape<Record<string, never>>;
  onContentSizeChange?: NativeEventShape<{ width: number; height: number }>;
  style?: TextStyle;
};

const nativeComponentIsRegistered =
  UIManager.getViewManagerConfig('YifanJustifiedText') != null;

if (!nativeComponentIsRegistered) {
  console.warn(
    '[JustifiedBodyText] YifanJustifiedText native component not registered — falling back to JS <Text>. Rebuild the app to pick up native changes.',
  );
}

// Cache on globalThis so HMR re-evaluating this module doesn't call
// requireNativeComponent a second time — the RN view registry throws
// `Tried to register two views with the same name` on the second call.
// No effect in production (module runs once).
const NATIVE_CACHE_KEY = '__YifanJustifiedTextNativeComponent__';
type NativeCache = {
  [NATIVE_CACHE_KEY]?: React.ComponentType<NativeProps> | null;
};
const nativeCache = globalThis as NativeCache;
if (!(NATIVE_CACHE_KEY in nativeCache)) {
  nativeCache[NATIVE_CACHE_KEY] = nativeComponentIsRegistered
    ? (requireNativeComponent<NativeProps>(
        'YifanJustifiedText',
      ) as React.ComponentType<NativeProps>)
    : null;
}
const NativeJustifiedText = nativeCache[NATIVE_CACHE_KEY] ?? null;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  linkText: { textDecorationLine: 'underline' },
});

type NativeViewProps = {
  segments: JustifiedBodySegment[];
  textColor: string;
  accentColor: string;
  activeTag?: string | null;
  tagActiveTextColor?: string;
  tagActiveBackgroundColor?: string;
  tagInactiveBackgroundColor?: string;
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  justify: boolean;
  onPressMention: (screenName: string) => void;
  onPressTag: (tag: string) => void;
  onPressText: () => void;
};

const NativeJustifiedBodyText = ({
  segments,
  textColor,
  accentColor,
  activeTag,
  tagActiveTextColor,
  tagActiveBackgroundColor,
  tagInactiveBackgroundColor,
  fontFamily,
  fontSize,
  lineHeight,
  justify,
  onPressMention,
  onPressTag,
  onPressText,
}: NativeViewProps) => {
  // Native view reports its required height back via onContentSizeChange.
  // Estimate 2 lines on first render to keep the layout from jumping by
  // a visible amount for typical short posts.
  const [height, setHeight] = useState(lineHeight * 2);
  if (!NativeJustifiedText) return null;
  const normalizedActiveTag = activeTag?.toLowerCase();
  return (
    <View style={{ height }}>
      <NativeJustifiedText
        segments={segments}
        textColor={textColor}
        accentColor={accentColor}
        tagActiveColor={tagActiveTextColor}
        tagActiveBackgroundColor={tagActiveBackgroundColor}
        tagInactiveBackgroundColor={tagInactiveBackgroundColor}
        activeTag={normalizedActiveTag ?? undefined}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        justify={justify}
        onPressMention={event => onPressMention(event.nativeEvent.screenName)}
        onPressTag={event => onPressTag(event.nativeEvent.tag)}
        onPressLink={event => openLink(event.nativeEvent.href)}
        onPressText={onPressText}
        onContentSizeChange={event => {
          const next = event.nativeEvent.height;
          setHeight(prev => (Math.abs(prev - next) < 0.5 ? prev : next));
        }}
        style={styles.fill}
      />
    </View>
  );
};

const JustifiedBodyText = ({
  segments,
  textColor,
  accentColor,
  activeTag,
  tagActivePillClass,
  tagInactivePillClass,
  tagActiveBackgroundColor,
  tagInactiveBackgroundColor,
  tagActiveTextColor,
  fontFamily,
  fontSize,
  lineHeight,
  justify,
  onPressMention,
  onPressTag,
  onPressText,
  renderPlainTextSegment,
}: JustifiedBodyTextProps) => {
  if (NativeJustifiedText) {
    // Single flattened attributed string on both platforms — mentions /
    // tags / links are attributes, not nested <Text>. That's what lets
    // iOS's CJK inter-character justify (via CoreText) and Android's
    // JUSTIFICATION_MODE_INTER_CHARACTER (API 35+) stretch glyphs
    // across the whole line instead of collapsing at each interactive
    // run. Pre-API-35 Android falls back to left-aligned here, which
    // is the honest default.
    return (
      <NativeJustifiedBodyText
        segments={segments}
        textColor={textColor}
        accentColor={accentColor}
        activeTag={activeTag}
        tagActiveTextColor={tagActiveTextColor}
        tagActiveBackgroundColor={tagActiveBackgroundColor}
        tagInactiveBackgroundColor={tagInactiveBackgroundColor}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        justify={justify}
        onPressMention={onPressMention}
        onPressTag={onPressTag}
        onPressText={onPressText}
      />
    );
  }

  // Last-resort JS fallback — native view didn't register (stale
  // binary). Nested <Text> is the only thing the platform gives us
  // here; no justify.
  return (
    <AppText
      skipFont
      className="text-[15px] leading-6 text-foreground"
      style={{ color: textColor }}
      textBreakStrategy="simple"
    >
      {segments.map((segment, index) => {
        const key = `seg-${index}`;
        if (segment.type === 'mention') {
          return (
            <Text
              key={key}
              style={{ color: accentColor }}
              onPress={event => {
                event.stopPropagation();
                onPressMention(segment.screenName);
              }}
            >
              {segment.text}
            </Text>
          );
        }
        if (segment.type === 'tag') {
          const isActive =
            Boolean(activeTag) &&
            activeTag?.toLowerCase() === segment.tag.toLowerCase();
          return (
            <Text
              key={key}
              className={isActive ? tagActivePillClass : tagInactivePillClass}
              onPress={event => {
                event.stopPropagation();
                onPressTag(segment.tag);
              }}
            >
              {segment.text}
            </Text>
          );
        }
        if (segment.type === 'link') {
          return (
            <Text
              key={key}
              style={[{ color: accentColor }, styles.linkText]}
              onPress={event => {
                event.stopPropagation();
                openLink(segment.href);
              }}
            >
              {segment.text}
            </Text>
          );
        }
        return renderPlainTextSegment(segment.text, key);
      })}
    </AppText>
  );
};

export default JustifiedBodyText;
