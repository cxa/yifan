import type { TextStyle, ViewStyle } from 'react-native';
import type { FanfouUser } from '@/types/fanfou';

const HEX_COLOR_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type ProfileThemeSource = Pick<
  FanfouUser,
  | 'profile_background_color'
  | 'profile_text_color'
  | 'profile_link_color'
  | 'profile_sidebar_fill_color'
  | 'profile_sidebar_border_color'
  | 'profile_background_image_url'
  | 'profile_background_tile'
>;

export type ProfileThemePalette = {
  pageBackgroundColor?: string;
  panelBackgroundColor?: string;
  panelBorderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  linkColor?: string;
  backgroundImageUrl?: string;
  isBackgroundImageTiled: boolean;
};

export type ProfileThemeStyles = {
  panelStyle?: ViewStyle;
  primaryTextStyle?: TextStyle;
  mutedTextStyle?: TextStyle;
  linkTextStyle?: TextStyle;
};

const normalizeHexColor = (value?: string | null): string | undefined => {
  const trimmedValue = value?.trim();
  if (!trimmedValue || !HEX_COLOR_PATTERN.test(trimmedValue)) {
    return undefined;
  }
  const normalizedHex = trimmedValue.replace('#', '');
  if (normalizedHex.length === 3) {
    const [r, g, b] = normalizedHex.split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return `#${normalizedHex}`.toUpperCase();
};

const resolveColorChannels = (
  normalizedHexColor: string,
): [number, number, number] => {
  const hexValue = normalizedHexColor.slice(1);
  const red = Number.parseInt(hexValue.slice(0, 2), 16);
  const green = Number.parseInt(hexValue.slice(2, 4), 16);
  const blue = Number.parseInt(hexValue.slice(4, 6), 16);
  return [red, green, blue];
};

const withAlpha = (normalizedHexColor: string, alpha: number): string => {
  const [red, green, blue] = resolveColorChannels(normalizedHexColor);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const normalizeBackgroundImageUrl = (
  value?: string | null,
): string | undefined => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return undefined;
  }
  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : undefined;
};

export const resolveProfileThemePalette = (
  user?: ProfileThemeSource | null,
): ProfileThemePalette => {
  const textColor = normalizeHexColor(user?.profile_text_color);
  return {
    pageBackgroundColor: normalizeHexColor(user?.profile_background_color),
    panelBackgroundColor: normalizeHexColor(user?.profile_sidebar_fill_color),
    panelBorderColor: normalizeHexColor(user?.profile_sidebar_border_color),
    textColor,
    mutedTextColor: textColor ? withAlpha(textColor, 0.74) : undefined,
    linkColor: normalizeHexColor(user?.profile_link_color),
    backgroundImageUrl: normalizeBackgroundImageUrl(
      user?.profile_background_image_url,
    ),
    isBackgroundImageTiled: user?.profile_background_tile === true,
  };
};

export const createProfileThemeStyles = (
  palette: ProfileThemePalette,
): ProfileThemeStyles => {
  const panelStyle =
    palette.panelBackgroundColor || palette.panelBorderColor
      ? {
          ...(palette.panelBackgroundColor
            ? { backgroundColor: palette.panelBackgroundColor }
            : {}),
          ...(palette.panelBorderColor
            ? { borderColor: palette.panelBorderColor }
            : {}),
        }
      : undefined;
  return {
    panelStyle,
    primaryTextStyle: palette.textColor
      ? { color: palette.textColor }
      : undefined,
    mutedTextStyle: palette.mutedTextColor
      ? { color: palette.mutedTextColor }
      : undefined,
    linkTextStyle: palette.linkColor ? { color: palette.linkColor } : undefined,
  };
};

const toLinearChannel = (value: number) => {
  const normalized = value / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
};

const getRelativeLuminance = (normalizedHexColor: string) => {
  const [red, green, blue] = resolveColorChannels(normalizedHexColor);
  const linearRed = toLinearChannel(red);
  const linearGreen = toLinearChannel(green);
  const linearBlue = toLinearChannel(blue);
  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
};

export const isColorDark = (color: string) => {
  const normalizedColor = normalizeHexColor(color);
  if (!normalizedColor) {
    return undefined;
  }
  return getRelativeLuminance(normalizedColor) < 0.5;
};

const getContrastRatio = (firstColor: string, secondColor: string) => {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

export const resolveReadableTextColor = ({
  backgroundColor,
  lightTextColor = '#FFFFFF',
  darkTextColor = '#111111',
}: {
  backgroundColor: string;
  lightTextColor?: string;
  darkTextColor?: string;
}) => {
  const normalizedBackgroundColor = normalizeHexColor(backgroundColor);
  const normalizedLightTextColor = normalizeHexColor(lightTextColor);
  const normalizedDarkTextColor = normalizeHexColor(darkTextColor);
  if (
    !normalizedBackgroundColor ||
    !normalizedLightTextColor ||
    !normalizedDarkTextColor
  ) {
    return undefined;
  }
  const lightContrast = getContrastRatio(
    normalizedBackgroundColor,
    normalizedLightTextColor,
  );
  const darkContrast = getContrastRatio(
    normalizedBackgroundColor,
    normalizedDarkTextColor,
  );
  return lightContrast >= darkContrast
    ? normalizedLightTextColor
    : normalizedDarkTextColor;
};
