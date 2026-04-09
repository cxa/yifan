import React, { useState } from 'react';
import { Pressable, View, useWindowDimensions, type DimensionValue } from 'react-native';
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
import type { RootStackParamList } from '@/navigation/types';
import { ROOT_STACK_ROUTE } from '@/navigation/route-names';

// ---------------------------------------------------------------------------
// Preview palette — mirrors timeline-skeleton-card.tsx exactly, no shimmer
// ---------------------------------------------------------------------------
const CARD_BG_LIGHT = ['#FDDBD5', '#FDF3C8', '#E8D5F5', '#D0E8F5'] as const;
const CARD_BG_DARK  = ['#3D2820', '#352E18', '#2D1E38', '#1A2E3D'] as const;
const BAR_BG_LIGHT  = ['#F5C4B8', '#F5E298', '#CCBAEC', '#A8D0EC'] as const;
const BAR_BG_DARK   = ['#5A3830', '#4A4020', '#402850', '#203A50'] as const;

const LIST_BG_LIGHT   = '#F5EDE0';
const LIST_BG_DARK    = '#0E0B07';
const PLAIN_CARD_LIGHT = '#FFFFFF';
const PLAIN_CARD_DARK  = '#1E1E1E';
const PLAIN_BAR_LIGHT  = 'rgba(0,0,0,0.08)';
const PLAIN_BAR_DARK   = 'rgba(255,255,255,0.12)';

// One row of skeleton bars per card (line widths match the real skeleton card)
const LINE_CONFIGS: readonly (readonly DimensionValue[])[] = [
  ['75%', '90%'],
  ['85%', '65%', '80%'],
  ['90%', '70%'],
  ['70%', '88%', '60%'],
];

// ---------------------------------------------------------------------------
// MiniSkeletonCard — mirrors TimelineSkeletonCard without shimmer animation
// ---------------------------------------------------------------------------
type MiniSkeletonCardProps = {
  cardBg: string;
  barColor: string;
  lineWidths: readonly DimensionValue[];
  isLast: boolean;
};

const MiniSkeletonCard = ({ cardBg, barColor, lineWidths, isLast }: MiniSkeletonCardProps) => {
  const mb = isLast ? 0 : 6;
  return (
  <View
    className="rounded-2xl px-3 py-3"
    style={[{ backgroundColor: cardBg, marginBottom: mb }]}
  >
    <View className="flex-row gap-2">
      {/* Avatar circle */}
      <View className="h-8 w-8 rounded-full" style={[{ backgroundColor: barColor }]} />
      {/* Text lines */}
      <View className="flex-1 gap-[5px]">
        {/* Name bar */}
        <View className="h-[7px] w-14 rounded-full" style={[{ backgroundColor: barColor }]} />
        {/* Content bars */}
        {lineWidths.map((w, i) => {
          const opacity = 0.7 - i * 0.15;
          return (
            <View
              key={i}
              className="h-[7px] rounded-full"
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
// MiniTimeline — 4 skeleton cards rendered for the given mode combination
// ---------------------------------------------------------------------------
type MiniTimelineProps = {
  previewIsDark: boolean;
  previewIsColorful: boolean;
};

const MiniTimeline = ({ previewIsDark, previewIsColorful }: MiniTimelineProps) => {
  const listBg = previewIsDark ? LIST_BG_DARK : LIST_BG_LIGHT;
  const plainCard = previewIsDark ? PLAIN_CARD_DARK : PLAIN_CARD_LIGHT;
  const plainBar  = previewIsDark ? PLAIN_BAR_DARK  : PLAIN_BAR_LIGHT;

  return (
    <View className="flex-1 p-2" style={[{ backgroundColor: listBg }]}>
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
          />
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// OptionPanel — preview + label, highlighted border when selected
// ---------------------------------------------------------------------------
type OptionPanelProps = {
  label: string;
  previewIsDark: boolean;
  previewIsColorful: boolean;
  isSelected: boolean;
  accentColor: string;
  onPress: () => void;
};

const OptionPanel = ({
  label,
  previewIsDark,
  previewIsColorful,
  isSelected,
  accentColor,
  onPress,
}: OptionPanelProps) => {
  const borderColor = isSelected ? accentColor : 'transparent';
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
        className="flex-1 rounded-2xl overflow-hidden border-[2.5px]"
        style={[{ borderColor }]}
      >
        <MiniTimeline previewIsDark={previewIsDark} previewIsColorful={previewIsColorful} />
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
// Main onboarding screen
// ---------------------------------------------------------------------------
type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;

const OnboardingScreen = () => {
  const [step, setStep] = useState<Step>(1);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const appearance = useAppAppearancePreference();
  const theme = useAppThemePreference();
  const isDark = useEffectiveIsDark();
  const [accent] = useThemeColor(['accent']);

  const goToApp = () =>
    navigation.reset({ index: 0, routes: [{ name: ROOT_STACK_ROUTE.AUTH }] });

  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else goToApp();
  };

  const handleSelect = (value: string) => {
    if (step === 1) {
      setAppAppearancePreference(
        value as (typeof APP_APPEARANCE_OPTION)[keyof typeof APP_APPEARANCE_OPTION],
      ).catch(() => {});
    } else if (step === 2) {
      setAppThemePreference(
        value as (typeof APP_THEME_OPTION)[keyof typeof APP_THEME_OPTION],
      ).catch(() => {});
    }
  };

  // Step 1: pick appearance — preview both modes with colorful theme
  const step1Options = [
    {
      value: APP_APPEARANCE_OPTION.LIGHT,
      label: t('onboardingOptionLight'),
      previewIsDark: false,
      previewIsColorful: true,
    },
    {
      value: APP_APPEARANCE_OPTION.DARK,
      label: t('onboardingOptionDark'),
      previewIsDark: true,
      previewIsColorful: true,
    },
  ];

  // Step 2: pick theme — preview both styles in chosen appearance
  const step2Options = [
    {
      value: APP_THEME_OPTION.COLORFUL,
      label: t('onboardingOptionColorful'),
      previewIsDark: isDark,
      previewIsColorful: true,
    },
    {
      value: APP_THEME_OPTION.PLAIN,
      label: t('onboardingOptionPlain'),
      previewIsDark: isDark,
      previewIsColorful: false,
    },
  ];

  const options = step === 1 ? step1Options : step2Options;
  const selectedValue = step === 1 ? appearance : theme;

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
      {/* Header: step indicator + skip */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-[13px] text-muted">{step} / {TOTAL_STEPS}</Text>
        <Pressable onPress={goToApp} hitSlop={12} accessibilityRole="button">
          <Text className="text-[15px] text-muted">{t('onboardingSkip')}</Text>
        </Pressable>
      </View>

      {/* Title */}
      <Text className="px-5 pb-4 text-[22px] font-bold text-foreground">
        {step === 1 ? t('onboardingStepAppearance') : t('onboardingStepTheme')}
      </Text>

      {/* Option panels */}
      <View
        className={`flex-1 gap-3 px-5 ${isLandscape ? 'flex-row' : 'flex-col'}`}
      >
        {options.map(option => (
          <OptionPanel
            key={option.value}
            label={option.label}
            previewIsDark={option.previewIsDark}
            previewIsColorful={option.previewIsColorful}
            isSelected={selectedValue === option.value}
            accentColor={accent}
            onPress={() => handleSelect(option.value)}
          />
        ))}
      </View>

      {/* Footer: next / done */}
      <View className="px-5 pb-2 pt-4">
        <Pressable
          onPress={handleNext}
          className="items-center rounded-full bg-accent py-4"
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
