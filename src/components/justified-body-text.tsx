import React, { useState } from 'react';
import {
  Platform,
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
  tagActivePillClass?: string; // unused on iOS native path; JS fallback uses it
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

const nativeIOSComponentIsRegistered =
  Platform.OS === 'ios' &&
  UIManager.getViewManagerConfig('YifanJustifiedText') != null;

if (Platform.OS === 'ios' && !nativeIOSComponentIsRegistered) {
  console.warn(
    '[JustifiedBodyText] YifanJustifiedText native component not registered — falling back to JS <Text>. Rebuild iOS after `bundle exec pod install` to pick it up.',
  );
}

const NativeJustifiedText = nativeIOSComponentIsRegistered
  ? (requireNativeComponent<NativeProps>(
      'YifanJustifiedText',
    ) as React.ComponentType<NativeProps>)
  : null;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  linkText: { textDecorationLine: 'underline' },
});

type IOSProps = {
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

const IOSJustifiedBodyText = ({
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
}: IOSProps) => {
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
  if (Platform.OS === 'ios' && NativeJustifiedText) {
    // The native iOS view builds one NSAttributedString so mentions /
    // tags / links are attributes rather than nested <Text>, which lets
    // iOS's CJK inter-character justify span an entire line instead of
    // collapsing at each interactive run.
    return (
      <IOSJustifiedBodyText
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

  // Android (and any platform without the native view) stays on the
  // stock nested Text path. CJK justify can't work reliably there
  // anyway until API 35, so left-align is the honest default.
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
