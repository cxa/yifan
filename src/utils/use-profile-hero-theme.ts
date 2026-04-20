import { useEffectiveIsDark } from '@/settings/app-appearance-preference';
import type { FanfouUser } from '@/types/fanfou';
import {
  adaptProfilePaletteForDarkMode,
  createProfileThemeStyles,
  deriveHeroTextStyles,
  resolveProfileThemePalette,
  type HeroTextStyles,
  type ProfileThemePalette,
  type ProfileThemeStyles,
} from '@/utils/profile-theme';
import { useSampledBackgroundColor } from '@/utils/use-sampled-background-color';

export type ProfileHeroTheme = {
  profileThemePalette: ProfileThemePalette;
  profileThemeStyles: ProfileThemeStyles;
  heroTextStyles: HeroTextStyles;
  hasBackgroundImage: boolean;
};

/**
 * One-stop hook for screens that host a profile hero on their own page
 * background (Profile detail, More). Resolves the palette from the Fanfou
 * user, adapts for dark mode, samples the background image for a
 * representative colour, and derives the auto-contrast hero text styles
 * — so callers don't repeat the ritual.
 */
export const useProfileHeroTheme = (
  user: FanfouUser | null | undefined,
  { followProfileTheme }: { followProfileTheme: boolean },
): ProfileHeroTheme => {
  const isDark = useEffectiveIsDark();
  const basePalette = followProfileTheme
    ? resolveProfileThemePalette(user)
    : resolveProfileThemePalette(undefined);
  const profileThemePalette =
    followProfileTheme && isDark
      ? adaptProfilePaletteForDarkMode(basePalette)
      : basePalette;
  const hasBackgroundImage = Boolean(profileThemePalette.backgroundImageUrl);
  const sampledBackgroundColor = useSampledBackgroundColor(
    profileThemePalette.backgroundImageUrl,
  );
  const profileThemeStyles = createProfileThemeStyles(profileThemePalette);
  const heroTextStyles = deriveHeroTextStyles({
    pageBackgroundColor: profileThemePalette.pageBackgroundColor,
    textColor: profileThemePalette.textColor,
    hasBackgroundImage,
    isBackgroundImageTiled: profileThemePalette.isBackgroundImageTiled,
    sampledBackgroundColor,
    isDark,
  });
  return {
    profileThemePalette,
    profileThemeStyles,
    heroTextStyles,
    hasBackgroundImage,
  };
};
