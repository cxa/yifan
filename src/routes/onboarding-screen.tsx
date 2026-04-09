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
  const mb = isLast ? 0 : 6;
  const radius = isSharp ? 'rounded-none' : 'rounded-3xl';
  const avatarRadius = isSharp ? 'rounded-none' : 'rounded-full';
  const barRadius = isSharp ? 'rounded-none' : 'rounded-full';
  return (
    <View
      className={`${radius} px-4 py-4`}
      style={[{ backgroundColor: cardBg, marginBottom: mb }]}
    >
      <View className="flex-row gap-2">
        <View className={`h-8 w-8 ${avatarRadius}`} style={[{ backgroundColor: barColor }]} />
        <View className="flex-1 gap-[5px]">
          <View className={`h-[7px] w-14 ${barRadius}`} style={[{ backgroundColor: barColor }]} />
          {lineWidths.map((w, i) => {
            const opacity = 0.7 - i * 0.15;
            return (
              <View
                key={i}
                className={`h-[7px] ${barRadius}`}
                style={[{ width: w, backgroundColor: barColor, opacity }]}
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
        const cardBg   = previewIsColorful ? (previewIsDark ? CARD_BG_DARK : CARD_BG_LIGHT)[i] : plainCard;
        const barColor = previewIsColorful ? (previewIsDark ? BAR_BG_DARK  : BAR_BG_LIGHT )[i] : plainBar;
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
// OptionPanel
// ---------------------------------------------------------------------------
type OptionPanelProps = {
  label: string;
  previewIsDark: boolean;
  previewIsColorful: boolean;
  previewIsSharp: boolean;
  isSelected: boolean;
  accentColor: string;
  appBg: string;
  onPress: () => void;
};

const OptionPanel = ({
  label,
  previewIsDark,
  previewIsColorful,
  previewIsSharp,
  isSelected,
  accentColor,
  appBg,
  onPress,
}: OptionPanelProps) => {
  const borderColor = isSelected ? accentColor : appBg;
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
        <MiniTimeline
          previewIsDark={previewIsDark}
          previewIsColorful={previewIsColorful}
          previewIsSharp={previewIsSharp}
        />
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
  const [accent, appBg] = useThemeColor(['accent', 'background']);

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

  // Step 1: appearance — preview both light/dark with colorful cards
  const step1Options = [
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
              appBg={appBg}
              onPress={() => handleSelect(option.value)}
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
