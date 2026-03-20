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

export const resolveProfilePanelShadowStyle = (
  palette: ProfileThemePalette,
): ViewStyle | undefined => {
  if (!palette.panelBorderColor) {
    return undefined;
  }
  return {
    backgroundColor: palette.panelBorderColor,
  };
};

// ─── Dark-mode palette adaptation ────────────────────────────────────────────

const hexToHSL = (hex: string): [number, number, number] => {
  const [r, g, b] = resolveColorChannels(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue2rgb = (p: number, q: number, t: number): number => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) =>
    Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Adapt a single hex color for dark mode.
 *
 * - background: keep hue, mute saturation, target L ≈ 10%
 * - panel:      same but L ≈ 17% (visually above the background)
 * - border:     same but L ≈ 26%
 * - text:       if originally dark (for light bg), flip to near-white
 * - link:       keep hue/saturation, clamp L to [0.60, 0.75] for readability
 *
 * Colors already in dark territory are returned as-is.
 */
const adaptColorToDark = (
  hex: string,
  role: 'background' | 'panel' | 'border' | 'text' | 'link',
): string => {
  const [h, s, l] = hexToHSL(hex);
  switch (role) {
    case 'background':
      if (l < 0.2) return hex;
      return hslToHex(h, Math.min(s * 0.55, 0.3), 0.10);
    case 'panel':
      if (l < 0.28) return hex;
      return hslToHex(h, Math.min(s * 0.55, 0.3), 0.17);
    case 'border':
      if (l < 0.35) return hex;
      return hslToHex(h, Math.min(s * 0.45, 0.25), 0.26);
    case 'text':
      if (l >= 0.6) return hex;
      return hslToHex(h, Math.min(s * 0.25, 0.12), 0.88);
    case 'link':
      if (l >= 0.55) return hex;
      return hslToHex(h, s, Math.min(l + 0.35, 0.68));
  }
};

/**
 * Derive a dark-mode variant of a profile palette.
 * Call this when the user has opted into profile theme colours and the
 * device is in dark mode.
 */
export const adaptProfilePaletteForDarkMode = (
  palette: ProfileThemePalette,
): ProfileThemePalette => {
  const adapt = (
    color: string | undefined,
    role: Parameters<typeof adaptColorToDark>[1],
  ) => (color ? adaptColorToDark(color, role) : undefined);

  const darkText = adapt(palette.textColor, 'text');
  return {
    ...palette,
    pageBackgroundColor: adapt(palette.pageBackgroundColor, 'background'),
    panelBackgroundColor: adapt(palette.panelBackgroundColor, 'panel'),
    panelBorderColor: adapt(palette.panelBorderColor, 'border'),
    textColor: darkText,
    mutedTextColor: darkText ? withAlpha(darkText, 0.74) : palette.mutedTextColor,
    linkColor: adapt(palette.linkColor, 'link'),
    // Background images are designed for light mode — suppress them in dark mode
    // so the adapted background colour shows instead.
    backgroundImageUrl: undefined,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

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
