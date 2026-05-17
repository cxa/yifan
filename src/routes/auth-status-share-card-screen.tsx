import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from 'heroui-native';
import { AlertCircle } from 'lucide-react-native';

import { Text } from '@/components/app-text';
import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import TimelineEmptyPlaceholder from '@/components/timeline-empty-placeholder';
import ShareStatusCard, {
  SHARE_CARD_ASPECTS,
  SHARE_CARD_COLORS,
  resolveShareCardBackground,
  type ShareCardAspect,
  type ShareCardColor,
  type ShareCardCorners,
  type ShareCardTheme,
} from '@/components/share-status-card';
import { get } from '@/auth/fanfou-client';
import { useAppFontFamily } from '@/settings/app-font-preference';
import { showVariantToast } from '@/utils/toast-alert';
import { shareCapturedImage } from '@/utils/share-captured-image';
import type {
  AuthStackParamList,
} from '@/navigation/types';
import { AUTH_STACK_ROUTE } from '@/navigation/route-names';
import type { FanfouStatus } from '@/types/fanfou';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const normalizeStatus = (value: unknown): FanfouStatus | null =>
  isRecord(value) ? (value as FanfouStatus) : null;

const HORIZONTAL_PADDING = 20;
const PREVIEW_MAX_HEIGHT = 480;
const SWATCH_INACTIVE_BORDER = 'rgba(0,0,0,0.12)';
const SHARE_BTN_LABEL = '#FFFFFF';

const StatusShareCardRoute = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route =
    useRoute<RouteProp<AuthStackParamList, typeof AUTH_STACK_ROUTE.STATUS_SHARE_CARD>>();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const fontFamily = useAppFontFamily() ?? undefined;
  const { t } = useTranslation();
  const [accent, background, foreground, muted] = useThemeColor([
    'accent',
    'background',
    'foreground',
    'muted',
  ]);

  const routeStatusId = route.params.statusId.trim();
  const [aspect, setAspect] = useState<ShareCardAspect>('auto');
  const aspectLabels: Record<ShareCardAspect, string> = {
    auto: t('shareCardAspectAuto'),
    '1:1': '1:1',
    '3:4': '3:4',
    '9:16': '9:16',
  };
  const [theme, setTheme] = useState<ShareCardTheme>('light');
  const [color, setColor] = useState<ShareCardColor>('cream');
  const [corners, setCorners] = useState<ShareCardCorners>('rounded');

  // Black on light reads as a dark card on a bright page — visually jarring
  // and useless for the bright-themed sharing scenarios we want to support.
  // Mirror the constraint for dark to keep the picker symmetric.
  const availableColors = SHARE_CARD_COLORS.filter(swatch => {
    if (theme === 'light' && swatch === 'black') return false;
    if (theme === 'dark' && swatch === 'white') return false;
    return true;
  });

  // If the currently selected swatch is filtered out by the new theme,
  // fall back to cream so the preview never lands on an unavailable option.
  useEffect(() => {
    if (!availableColors.includes(color)) {
      setColor('cream');
    }
  }, [availableColors, color]);
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    navigation.setOptions({ title: t('shareCardScreenTitle') });
  }, [navigation, t]);

  const {
    data: status,
    isLoading,
    error,
  } = useQuery<FanfouStatus | null>({
    queryKey: ['status', 'detail', routeStatusId],
    queryFn: async () => {
      const data = await get('/statuses/show', {
        id: routeStatusId,
        mode: 'default',
      });
      return normalizeStatus(data);
    },
    enabled: Boolean(routeStatusId),
  });

  const handleShare = async () => {
    if (!cardRef.current || isSharing) return;
    setIsSharing(true);
    try {
      await shareCapturedImage(cardRef);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showVariantToast('danger', t('shareCardFailedTitle'), message);
    } finally {
      setIsSharing(false);
    }
  };

  if (!routeStatusId) {
    return (
      <View className="flex-1 bg-background">
        <TimelineEmptyPlaceholder
          icon={AlertCircle}
          message={t('statusMissingId')}
          tone="danger"
        />
      </View>
    );
  }

  if (isLoading && !status) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={{ paddingTop: headerHeight }}
      >
        <NeobrutalActivityIndicator />
      </View>
    );
  }

  if (!status) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: headerHeight }}
      >
        <TimelineEmptyPlaceholder
          icon={AlertCircle}
          message={t('statusLoadFailed')}
          detail={error instanceof Error ? error.message : null}
          tone="danger"
        />
      </View>
    );
  }

  const aspectEntry =
    SHARE_CARD_ASPECTS.find(item => item.key === aspect) ??
    SHARE_CARD_ASPECTS[0];
  const previewMaxWidth = viewportWidth - HORIZONTAL_PADDING * 2;
  // Auto-height cards just use the full preview width and let the
  // ScrollView absorb whatever vertical content height the card needs.
  const cardWidth =
    aspectEntry.ratio === null
      ? previewMaxWidth
      : Math.min(previewMaxWidth, PREVIEW_MAX_HEIGHT / aspectEntry.ratio);

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: headerHeight }}
    >
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.previewWrap}>
          <ShareStatusCard
            ref={cardRef}
            status={status}
            aspect={aspect}
            theme={theme}
            color={color}
            corners={corners}
            width={cardWidth}
          />
        </View>

        <View style={styles.controlStack}>
          <ControlGroup
            label={t('shareCardSizeLabel')}
            fontFamily={fontFamily}
            color={foreground}
          >
            <View style={styles.chipRow}>
              {SHARE_CARD_ASPECTS.map(item => (
                <ChipButton
                  key={item.key}
                  label={aspectLabels[item.key]}
                  active={aspect === item.key}
                  onPress={() => setAspect(item.key)}
                  accent={accent}
                  foreground={foreground}
                  muted={muted}
                  background={background}
                  fontFamily={fontFamily}
                />
              ))}
            </View>
          </ControlGroup>

          <ControlGroup
            label={t('shareCardThemeLabel')}
            fontFamily={fontFamily}
            color={foreground}
          >
            <View style={styles.chipRow}>
              <ChipButton
                label={t('shareCardThemeLight')}
                active={theme === 'light'}
                onPress={() => setTheme('light')}
                accent={accent}
                foreground={foreground}
                muted={muted}
                background={background}
                fontFamily={fontFamily}
              />
              <ChipButton
                label={t('shareCardThemeDark')}
                active={theme === 'dark'}
                onPress={() => setTheme('dark')}
                accent={accent}
                foreground={foreground}
                muted={muted}
                background={background}
                fontFamily={fontFamily}
              />
            </View>
          </ControlGroup>

          <ControlGroup
            label={t('shareCardCornersLabel')}
            fontFamily={fontFamily}
            color={foreground}
          >
            <View style={styles.chipRow}>
              <ChipButton
                label={t('shareCardCornersRounded')}
                active={corners === 'rounded'}
                onPress={() => setCorners('rounded')}
                accent={accent}
                foreground={foreground}
                muted={muted}
                background={background}
                fontFamily={fontFamily}
              />
              <ChipButton
                label={t('shareCardCornersSquare')}
                active={corners === 'square'}
                onPress={() => setCorners('square')}
                accent={accent}
                foreground={foreground}
                muted={muted}
                background={background}
                fontFamily={fontFamily}
              />
            </View>
          </ControlGroup>

          <ControlGroup
            label={t('shareCardColorLabel')}
            fontFamily={fontFamily}
            color={foreground}
          >
            <View style={styles.swatchRow}>
              {availableColors.map(swatch => {
                const swatchBg = resolveShareCardBackground(swatch, theme);
                const isActive = color === swatch;
                return (
                  <Pressable
                    key={swatch}
                    onPress={() => setColor(swatch)}
                    accessibilityRole="button"
                    accessibilityLabel={swatch}
                    style={[
                      styles.swatch,
                      isActive ? styles.swatchActive : styles.swatchInactive,
                      {
                        backgroundColor: swatchBg,
                        borderColor: isActive ? accent : SWATCH_INACTIVE_BORDER,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </ControlGroup>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: background,
          },
        ]}
      >
        <Pressable
          onPress={handleShare}
          disabled={isSharing}
          accessibilityRole="button"
          accessibilityLabel={t('shareCardShareButton')}
          style={[
            styles.shareBtn,
            isSharing ? styles.shareBtnDisabled : null,
            { backgroundColor: accent },
          ]}
        >
          <Text style={[styles.shareBtnText, fontFamily ? { fontFamily } : null]}>
            {isSharing ? t('shareCardSharing') : t('shareCardShareButton')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

type ControlGroupProps = {
  label: string;
  fontFamily: string | undefined;
  color: string;
  children: React.ReactNode;
};

const ControlGroup = ({
  label,
  fontFamily,
  color,
  children,
}: ControlGroupProps) => (
  <View style={styles.controlGroup}>
    <Text
      style={[
        styles.controlLabel,
        { color },
        fontFamily ? { fontFamily } : null,
      ]}
    >
      {label}
    </Text>
    {children}
  </View>
);

type ChipButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  accent: string;
  foreground: string;
  muted: string;
  background: string;
  fontFamily: string | undefined;
};

const ChipButton = ({
  label,
  active,
  onPress,
  accent,
  foreground,
  muted,
  background,
  fontFamily,
}: ChipButtonProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: active }}
    style={[
      styles.chip,
      {
        backgroundColor: active ? accent : background,
        borderColor: active ? accent : muted + '55',
      },
    ]}
  >
    <Text
      style={[
        styles.chipText,
        active ? styles.chipTextActive : { color: foreground },
        fontFamily ? { fontFamily } : null,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  scrollContent: {
    padding: HORIZONTAL_PADDING,
    alignItems: 'center',
    gap: 24,
  },
  previewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlStack: {
    width: '100%',
    gap: 18,
  },
  controlGroup: {
    gap: 10,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  swatchActive: {
    borderWidth: 3,
  },
  swatchInactive: {
    borderWidth: 1,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: SHARE_BTN_LABEL,
  },
  footer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  shareBtn: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnText: {
    color: SHARE_BTN_LABEL,
    fontSize: 16,
    fontWeight: '800',
  },
});

export default StatusShareCardRoute;
