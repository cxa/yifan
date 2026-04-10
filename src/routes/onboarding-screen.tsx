import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  UIManager,
  View,
  useWindowDimensions,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from 'heroui-native';
import { Text } from '@/components/app-text';
import Svg, { Defs, ClipPath, Polygon, Rect, Circle, G, Line } from 'react-native-svg';
import {
  APP_APPEARANCE_OPTION,
  useAppAppearancePreference,
  setAppAppearancePreference,
  useEffectiveIsDark,
} from '@/settings/app-appearance-preference';
import {
  APP_THEME_OPTION,
  useAppThemePreference,
  setAppThemePreference,
} from '@/settings/app-theme-preference';
import {
  APP_UI_STYLE_OPTION,
  useAppUiStylePreference,
  setAppUiStylePreference,
} from '@/settings/app-ui-style-preference';
import type { RootStackParamList } from '@/navigation/types';
import { ROOT_STACK_ROUTE } from '@/navigation/route-names';

// ---------------------------------------------------------------------------
// Preview palette — mirrors timeline-skeleton-card.tsx, no shimmer
// ---------------------------------------------------------------------------
const CARD_BG_LIGHT = ['#FDDBD5', '#FDF3C8', '#E8D5F5', '#D0E8F5'] as const;
const CARD_BG_DARK  = ['#3D2820', '#352E18', '#2D1E38', '#1A2E3D'] as const;
const BAR_BG_LIGHT  = ['#F5C4B8', '#F5E298', '#CCBAEC', '#A8D0EC'] as const;
const BAR_BG_DARK   = ['#5A3830', '#4A4020', '#402850', '#203A50'] as const;

const LIST_BG_LIGHT    = '#F5EDE0';
const LIST_BG_DARK     = '#0E0B07';
const PLAIN_CARD_LIGHT = '#FFFFFF';
const PLAIN_CARD_DARK  = '#1E1E1E';
const PLAIN_BAR_LIGHT  = 'rgba(0,0,0,0.08)';
const PLAIN_BAR_DARK   = 'rgba(255,255,255,0.12)';

const LINE_CONFIGS: readonly (readonly DimensionValue[])[] = [
  ['75%', '90%'],
  ['85%', '65%', '80%'],
  ['90%', '70%'],
  ['70%', '88%', '60%'],
  ['80%', '55%'],
  ['65%', '82%', '70%'],
  ['88%', '72%'],
];

// ---------------------------------------------------------------------------
// MiniSkeletonCard
// ---------------------------------------------------------------------------
type MiniSkeletonCardProps = {
  cardBg: string;
  barColor: string;
  lineWidths: readonly DimensionValue[];
  isLast: boolean;
  isSharp: boolean;
};

const MiniSkeletonCard = ({ cardBg, barColor, lineWidths, isLast, isSharp }: MiniSkeletonCardProps) => {
  const mb = isLast ? 0 : 10;
  const cardRadius = isSharp ? 0 : 24;
  const barRadius  = isSharp ? 0 : 9999;
  return (
    <View
      className="px-4 py-4"
      style={[{ backgroundColor: cardBg, marginBottom: mb, borderRadius: cardRadius }]}
    >
      <View className="flex-row gap-2">
        <View className="h-8 w-8 rounded-full" style={[{ backgroundColor: barColor }]} />
        <View className="flex-1 gap-[5px]">
          <View className="h-[7px] w-14" style={[{ borderRadius: barRadius, backgroundColor: barColor }]} />
          {lineWidths.map((w, i) => {
            const opacity = 0.7 - i * 0.15;
            return (
              <View
                key={i}
                className="h-[7px]"
                style={[{ width: w, borderRadius: barRadius, backgroundColor: barColor, opacity }]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// MiniTimeline
// ---------------------------------------------------------------------------
type MiniTimelineProps = {
  previewIsDark: boolean;
  previewIsColorful: boolean;
  previewIsSharp: boolean;
};

const MiniTimeline = ({ previewIsDark, previewIsColorful, previewIsSharp }: MiniTimelineProps) => {
  const listBg    = previewIsDark ? LIST_BG_DARK  : LIST_BG_LIGHT;
  const plainCard = previewIsDark ? PLAIN_CARD_DARK : PLAIN_CARD_LIGHT;
  const plainBar  = previewIsDark ? PLAIN_BAR_DARK  : PLAIN_BAR_LIGHT;

  return (
    <View className="flex-1 p-3" style={[{ backgroundColor: listBg }]}>
      {LINE_CONFIGS.map((lineWidths, i) => {
        const ci       = i % CARD_BG_LIGHT.length;
        const cardBg   = previewIsColorful ? (previewIsDark ? CARD_BG_DARK : CARD_BG_LIGHT)[ci] : plainCard;
        const barColor = previewIsColorful ? (previewIsDark ? BAR_BG_DARK  : BAR_BG_LIGHT )[ci] : plainBar;
        return (
          <MiniSkeletonCard
            key={i}
            cardBg={cardBg}
            barColor={barColor}
            lineWidths={lineWidths}
            isLast={i === LINE_CONFIGS.length - 1}
            isSharp={previewIsSharp}
          />
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// SystemSplitPreview — diagonal light/dark split for Follow System option
// ---------------------------------------------------------------------------
const renderSvgCard = (
  x: number, y: number, w: number, h: number,
  bg: string, bar: string,
) => {
  const avR = Math.min(h * 0.28, 7);
  const avCX = 10 + avR;
  const avCY = h / 2;
  const bX = avCX + avR + 5;
  const bH = Math.max(3, Math.floor(h * 0.12));
  const bMaxW = w - bX - 8;
  return (
    <G transform={`translate(${x} ${y})`}>
      <Rect width={w} height={h} rx={8} fill={bg} />
      <Circle cx={avCX} cy={avCY} r={avR} fill={bar} />
      <G transform={`translate(${bX} ${avCY - bH - 2})`}>
        <Rect width={bMaxW * 0.5} height={bH} rx={2} fill={bar} />
      </G>
      <G transform={`translate(${bX} ${avCY + 2})`}>
        <Rect width={bMaxW * 0.75} height={bH} rx={2} fill={bar} opacity={0.7} />
      </G>
    </G>
  );
};

const SystemSplitPreview = () => {
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  const pad = 8;
  const gap = 6;
  const count = 3;
  const cardH = h > 0 ? (h - pad * 2 - gap * (count - 1)) / count : 0;
  const topX  = w * 0.60; // diagonal x at top
  const botX  = w * 0.40; // diagonal x at bottom

  return (
    <View
      className="flex-1"
      onLayout={e => {
        setW(e.nativeEvent.layout.width);
        setH(e.nativeEvent.layout.height);
      }}
    >
      {w > 0 && h > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <ClipPath id="ob-light">
              <Polygon points={`0,0 ${topX},0 ${botX},${h} 0,${h}`} />
            </ClipPath>
            <ClipPath id="ob-dark">
              <Polygon points={`${topX},0 ${w},0 ${w},${h} ${botX},${h}`} />
            </ClipPath>
          </Defs>

          {/* Backgrounds — dark side uses a slightly elevated tone for card contrast */}
          <Polygon points={`0,0 ${topX},0 ${botX},${h} 0,${h}`} fill={LIST_BG_LIGHT} />
          <Polygon points={`${topX},0 ${w},0 ${w},${h} ${botX},${h}`} fill="#1C1810" />

          {/* Light-side cards */}
          <G clipPath="url(#ob-light)">
            {Array.from({ length: count }).map((_, i) => {
              const ci = i % CARD_BG_LIGHT.length;
              return (
                <G key={i}>
                  {renderSvgCard(pad, pad + i * (cardH + gap), w - pad * 2, cardH,
                    CARD_BG_LIGHT[ci], BAR_BG_LIGHT[ci])}
                </G>
              );
            })}
          </G>

          {/* Dark-side cards */}
          <G clipPath="url(#ob-dark)">
            {Array.from({ length: count }).map((_, i) => {
              const ci = i % CARD_BG_DARK.length;
              return (
                <G key={i}>
                  {renderSvgCard(pad, pad + i * (cardH + gap), w - pad * 2, cardH,
                    CARD_BG_DARK[ci], BAR_BG_DARK[ci])}
                </G>
              );
            })}
          </G>

          {/* Dividing line */}
          <Line
            x1={topX} y1={0} x2={botX} y2={h}
            stroke="rgba(128,128,128,0.4)"
            strokeWidth={1.5}
          />
        </Svg>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// OptionPanel
// ---------------------------------------------------------------------------
type OptionPanelProps = {
  label: string;
  previewIsDark: boolean;
  previewIsColorful: boolean;
  previewIsSharp: boolean;
  isSelected: boolean;
  accentColor: string;
  unselectedBorder: string;
  onPress: () => void;
  customPreview?: React.ReactNode;
};

const OptionPanel = ({
  label,
  previewIsDark,
  previewIsColorful,
  previewIsSharp,
  isSelected,
  accentColor,
  unselectedBorder,
  onPress,
  customPreview,
}: OptionPanelProps) => {
  const borderColor = isSelected ? accentColor : unselectedBorder;
  const labelBg    = previewIsDark ? LIST_BG_DARK  : LIST_BG_LIGHT;
  const labelColor  = previewIsDark ? '#D4C4A8' : '#1A1208';
  return (
    <Pressable
      className="flex-1"
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}
    >
      <View
        className="flex-1 rounded-3xl overflow-hidden border-[2.5px]"
        style={[{ borderColor }]}
      >
        {customPreview ?? (
          <MiniTimeline
            previewIsDark={previewIsDark}
            previewIsColorful={previewIsColorful}
            previewIsSharp={previewIsSharp}
          />
        )}
        <View
          className="py-[10px] items-center"
          style={[{ backgroundColor: labelBg }]}
        >
          <Text className="text-[13px] font-semibold" style={[{ color: labelColor }]}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const SLIDE_DIST   = 32;
const SLIDE_OUT_MS = 130;
const SLIDE_IN_MS  = 200;
const FOOTER_H_PAD = 40; // px-5 * 2
const FOOTER_GAP   = 12; // gap-3

const OnboardingScreen = () => {
  const [step, setStep] = useState<Step>(1);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const appearance = useAppAppearancePreference();
  const theme      = useAppThemePreference();
  const uiStyle    = useAppUiStylePreference();
  const isDark     = useEffectiveIsDark();
  const isColorful = theme === APP_THEME_OPTION.COLORFUL;
  const [accent] = useThemeColor(['accent']);
  const unselectedBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  // Content: tab-bar-style horizontal slide + fade (native driver)
  const slideX   = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Footer Previous button: spring-driven width + opacity (JS driver)
  // prevProgress: 0 = hidden, 1 = fully shown
  const prevProgress = useRef(new Animated.Value(0)).current;
  // 1/3 of available footer width (mirrors flex-[1] out of 3 total parts)
  const prevTargetWidth = (width - FOOTER_H_PAD - FOOTER_GAP) / 3;
  const prevAnimWidth   = prevProgress.interpolate({
    inputRange: [0, 1], outputRange: [0, prevTargetWidth],
  });
  const prevAnimMargin  = prevProgress.interpolate({
    inputRange: [0, 1], outputRange: [0, FOOTER_GAP],
  });

  const goToApp = () =>
    navigation.reset({ index: 0, routes: [{ name: ROOT_STACK_ROUTE.AUTH }] });

  const transitionTo = (next: Step) => {
    const dir     = next > step ? 1 : -1;
    const showPrev = next > 1 ? 1 : 0;

    // Previous button: spring open, ease closed (JS thread)
    if (showPrev === 1) {
      Animated.spring(prevProgress, {
        toValue: 1,
        bounciness: 10,
        speed: 14,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(prevProgress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }

    // Slide + fade the content area (native thread)
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: SLIDE_OUT_MS, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: -SLIDE_DIST * dir, duration: SLIDE_OUT_MS, useNativeDriver: true }),
    ]).start(() => {
      slideX.setValue(SLIDE_DIST * dir);
      setStep(next);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: SLIDE_IN_MS, useNativeDriver: true }),
        Animated.timing(slideX,   { toValue: 0, duration: SLIDE_IN_MS, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (step === 1) transitionTo(2);
    else if (step === 2) transitionTo(3);
    else goToApp();
  };

  const handlePrev = () => transitionTo((step - 1) as Step);

  const handleSelect = (value: string) => {
    if (step === 1) {
      setAppAppearancePreference(
        value as (typeof APP_APPEARANCE_OPTION)[keyof typeof APP_APPEARANCE_OPTION],
      ).catch(() => {});
    } else if (step === 2) {
      setAppThemePreference(
        value as (typeof APP_THEME_OPTION)[keyof typeof APP_THEME_OPTION],
      ).catch(() => {});
    } else {
      setAppUiStylePreference(
        value as (typeof APP_UI_STYLE_OPTION)[keyof typeof APP_UI_STYLE_OPTION],
      ).catch(() => {});
    }
  };

  // Step 1: appearance — AUTO uses diagonal split preview; Light/Dark use MiniTimeline
  const step1Options = [
    { value: APP_APPEARANCE_OPTION.AUTO,  label: t('onboardingOptionSystem'),
      previewIsDark: false, previewIsColorful: true, previewIsSharp: false,
      customPreview: <SystemSplitPreview /> },
    { value: APP_APPEARANCE_OPTION.LIGHT, label: t('onboardingOptionLight'),
      previewIsDark: false, previewIsColorful: true,  previewIsSharp: false },
    { value: APP_APPEARANCE_OPTION.DARK,  label: t('onboardingOptionDark'),
      previewIsDark: true,  previewIsColorful: true,  previewIsSharp: false },
  ];

  // Step 2: theme — preview colorful vs plain in chosen appearance
  const step2Options = [
    { value: APP_THEME_OPTION.COLORFUL, label: t('onboardingOptionColorful'),
      previewIsDark: isDark, previewIsColorful: true,  previewIsSharp: false },
    { value: APP_THEME_OPTION.PLAIN,    label: t('onboardingOptionPlain'),
      previewIsDark: isDark, previewIsColorful: false, previewIsSharp: false },
  ];

  // Step 3: UI style — preview soft (rounded) vs sharp (square)
  const step3Options = [
    { value: APP_UI_STYLE_OPTION.SOFT,  label: t('onboardingOptionSoft'),
      previewIsDark: isDark, previewIsColorful: isColorful, previewIsSharp: false },
    { value: APP_UI_STYLE_OPTION.SHARP, label: t('onboardingOptionSharp'),
      previewIsDark: isDark, previewIsColorful: isColorful, previewIsSharp: true },
  ];

  const options = step === 1 ? step1Options : step === 2 ? step2Options : step3Options;
  const selectedValue = step === 1 ? appearance : step === 2 ? theme : uiStyle;

  const stepTitle = step === 1
    ? t('onboardingStepAppearance')
    : step === 2
    ? t('onboardingStepTheme')
    : t('onboardingStepUiStyle');

  return (
    <View
      className="flex-1 bg-background"
      style={[{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-[13px] text-muted">{step} / {TOTAL_STEPS}</Text>
        <Pressable onPress={goToApp} hitSlop={12} accessibilityRole="button">
          <Text className="text-[15px] text-muted">{t('onboardingSkip')}</Text>
        </Pressable>
      </View>

      {/* Animated content: title + panels */}
      <Animated.View
        className="flex-1"
        style={[{ opacity: fadeAnim, transform: [{ translateX: slideX }] }]}
      >
        <Text className="px-5 pb-4 text-[22px] font-bold text-foreground">
          {stepTitle}
        </Text>

        <View className={`flex-1 gap-3 px-5 ${isLandscape ? 'flex-row' : 'flex-col'}`}>
          {options.map(option => (
            <OptionPanel
              key={option.value}
              label={option.label}
              previewIsDark={option.previewIsDark}
              previewIsColorful={option.previewIsColorful}
              previewIsSharp={option.previewIsSharp}
              isSelected={selectedValue === option.value}
              accentColor={accent}
              unselectedBorder={unselectedBorder}
              onPress={() => handleSelect(option.value)}
              customPreview={'customPreview' in option ? option.customPreview : undefined}
            />
          ))}
        </View>
      </Animated.View>

      {/* Footer: Previous springs in/out; Next fills remaining space */}
      <View className="flex-row px-5 pb-2 pt-4">
        <Animated.View
          className="overflow-hidden"
          style={[{ width: prevAnimWidth, marginRight: prevAnimMargin }]}
        >
          <Pressable
            onPress={handlePrev}
            className="flex-1 items-center rounded-full border border-muted py-4"
            accessibilityRole="button"
          >
            <Text className="text-[16px] font-semibold text-muted" numberOfLines={1}>
              {t('onboardingBack')}
            </Text>
          </Pressable>
        </Animated.View>
        <Pressable
          onPress={handleNext}
          className="flex-1 items-center rounded-full bg-accent py-4"
          accessibilityRole="button"
        >
          <Text className="text-[16px] font-bold text-accent-foreground">
            {step === TOTAL_STEPS ? t('onboardingDone') : t('onboardingNext')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default OnboardingScreen;
