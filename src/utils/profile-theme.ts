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

const toHexByte = (value: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0').toUpperCase();
};

/**
 * Blend two hex colors channel-wise.
 * weight = 0 returns `base`, weight = 1 returns `overlay`.
 * Both inputs must be 6-digit hex (#RRGGBB) or the function
 * falls back to returning `base`.
 */
export const blendHexColors = (
  base: string,
  overlay: string,
  weight: number,
): string => {
  const normalizedBase = normalizeHexColor(base);
  const normalizedOverlay = normalizeHexColor(overlay);
  if (!normalizedBase || !normalizedOverlay) return base;
  const [br, bg, bb] = resolveColorChannels(normalizedBase);
  const [or, og, ob] = resolveColorChannels(normalizedOverlay);
  const mix = (a: number, b: number) => a * (1 - weight) + b * weight;
  return `#${toHexByte(mix(br, or))}${toHexByte(mix(bg, og))}${toHexByte(mix(bb, ob))}`;
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

// Fanfou inherits Twitter's v1 schema and occasionally serialises boolean
// fields as strings ("true"/"false") or integers (1/0). Treat all the
// truthy spellings as tiled and everything else (including missing) as
// not-tiled — missing ought to mean "default, don't tile".
const isTruthyTileFlag = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
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
    isBackgroundImageTiled: isTruthyTileFlag(user?.profile_background_tile),
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
  // Text inside a themed panel sits on `profile_sidebar_fill_color`. The
  // user picks both colours independently, so the pair is not guaranteed
  // to be readable — tint the text when contrast falls below WCAG AA.
  const textOnPanel =
    palette.textColor && palette.panelBackgroundColor
      ? tintTextForBackground(palette.textColor, palette.panelBackgroundColor)
      : palette.textColor;
  return {
    panelStyle,
    primaryTextStyle: textOnPanel ? { color: textOnPanel } : undefined,
    mutedTextStyle: textOnPanel
      ? { color: withAlpha(textOnPanel, 0.74) }
      : undefined,
    linkTextStyle: palette.linkColor ? { color: palette.linkColor } : undefined,
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

/**
 * Return a version of `textColor` that contrasts with `backgroundColor`.
 * Preserves the user's hue and a reasonable saturation — we only swing the
 * lightness to the opposite extreme if the original doesn't clear the WCAG
 * AA threshold. If even a tinted extreme can't make it (mid-luminance bg),
 * fall back to pure black / white.
 */
export const tintTextForBackground = (
  textColor: string,
  backgroundColor: string,
  minContrast = 4.5,
): string => {
  const normalizedText = normalizeHexColor(textColor);
  const normalizedBg = normalizeHexColor(backgroundColor);
  if (!normalizedText || !normalizedBg) return textColor;
  if (getContrastRatio(normalizedText, normalizedBg) >= minContrast) {
    return normalizedText;
  }
  const [hue, saturation] = hexToHSL(normalizedText);
  const bgIsDark = getRelativeLuminance(normalizedBg) < 0.5;
  const tintedCandidate = hslToHex(
    hue,
    Math.min(saturation, 0.6),
    bgIsDark ? 0.88 : 0.12,
  );
  if (getContrastRatio(tintedCandidate, normalizedBg) >= minContrast) {
    return tintedCandidate;
  }
  return (
    resolveReadableTextColor({ backgroundColor: normalizedBg }) ??
    normalizedText
  );
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

export type HeroTextStyles = {
  primaryTextStyle?: TextStyle;
  mutedTextStyle?: TextStyle;
  textHaloStyle?: TextStyle;
};

/**
 * Produce a { primary, muted } text style pair that is guaranteed to
 * contrast with `backgroundColor`. Same rule as `tintTextForBackground`:
 * preserve the user's hue when possible, tint lightness when it isn't,
 * fall back to pure B/W as last resort.
 */
export const resolveTextStylesForBackground = (
  textColor: string | undefined,
  backgroundColor: string,
): HeroTextStyles => {
  // Keep the user's hue when possible, tint L to guarantee contrast,
  // fall back to pure B/W only when hue-tinting can't clear the bar.
  const heroColor = textColor
    ? tintTextForBackground(textColor, backgroundColor)
    : resolveReadableTextColor({ backgroundColor });
  if (!heroColor) return {};
  return {
    primaryTextStyle: { color: heroColor },
    mutedTextStyle: { color: withAlpha(heroColor, 0.74) },
  };
};

/**
 * Derive text styles for the hero row. What sits behind the hero text
 * depends on how the bg image is used:
 *
 * - Tiled image covers the whole viewport → pick contrast against the
 *   sampled image color. Halo fallback while the sample is in-flight.
 * - Non-tiled image is a top-left anchored decoration — the hero actually
 *   sits on the solid page background below the decoration, so contrast
 *   against `pageBackgroundColor`, NOT the sampled image colour.
 * - No image → same, against `pageBackgroundColor`.
 *
 * In dark mode with a background image, `ProfilePageBackdrop` lays a 0.8
 * black overlay between image and content. Hero text actually sits on top
 * of that overlay, so the effective contrast target is
 *   effective = sampled|page × 0.2 + black × 0.8.
 * Without this correction, the sample/page colour the hero was tinted
 * against is nowhere close to what the user actually sees.
 */
export const deriveHeroTextStyles = ({
  pageBackgroundColor,
  textColor,
  hasBackgroundImage,
  isBackgroundImageTiled,
  sampledBackgroundColor,
  isDark,
}: {
  pageBackgroundColor?: string;
  textColor?: string;
  hasBackgroundImage: boolean;
  isBackgroundImageTiled: boolean;
  sampledBackgroundColor?: string;
  isDark: boolean;
}): HeroTextStyles => {
  // In dark mode with a background image, `ProfilePageBackdrop` lays an
  // 80% pageBackgroundColor-tinted overlay between image and content. That
  // means the effective colour behind the hero text is `source × 0.2 +
  // pageBg × 0.8` — and for non-image regions, that collapses to `pageBg`.
  const applyDarkOverlay = (color: string) =>
    hasBackgroundImage && isDark && pageBackgroundColor
      ? blendHexColors(color, pageBackgroundColor, 0.8)
      : color;
  const imageCoversViewport = hasBackgroundImage && isBackgroundImageTiled;
  if (imageCoversViewport) {
    if (sampledBackgroundColor) {
      return resolveTextStylesForBackground(
        textColor,
        applyDarkOverlay(sampledBackgroundColor),
      );
    }
    if (!textColor) return {};
    const textIsDark = isColorDark(textColor);
    return {
      primaryTextStyle: { color: textColor },
      mutedTextStyle: { color: withAlpha(textColor, 0.74) },
      textHaloStyle: {
        textShadowColor: textIsDark
          ? 'rgba(255, 255, 255, 0.95)'
          : 'rgba(0, 0, 0, 0.9)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 3,
      },
    };
  }
  if (!pageBackgroundColor) {
    return {};
  }
  return resolveTextStylesForBackground(
    textColor,
    applyDarkOverlay(pageBackgroundColor),
  );
};
