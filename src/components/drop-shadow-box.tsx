import React from 'react';
import { View } from 'react-native';

export type DropShadowBoxType =
  | 'default'
  | 'danger'
  | 'warning'
  | 'success'
  | 'accent'
  | 'sky';

/** Rotate through pastel card backgrounds for visual variety in lists.
 * Punchy cool-first alternation: mint opens fresh, then warm/cool beats
 * trade off so adjacent cards always contrast hard while scrolling. */
export const CARD_PASTEL_CYCLE: DropShadowBoxType[] = [
  'success',  // mint   — cool green, fresh opener
  'accent',   // coral  — warm red
  'sky',      // sky    — cool blue
  'warning',  // apricot — warm yellow
  'danger',   // lilac  — cool purple
];

/** Light-mode pastel card background colors indexed by shadow type */
// Each hue has its own personality — widen the hue spread (coral / apricot /
// lilac / crisp sky / spring mint) and push saturation so they stop reading
// as "five slightly different warm pastels" and start reading as five
// distinct flavors. Slight lightness variance adds rhythm when scrolling.
export const CARD_BG_LIGHT: Record<DropShadowBoxType, string> = {
  default: '#F7EFE0',
  accent:  '#F6D6CB', // coral — desaturated from #FFD6CA so large cards don't glare on white
  warning: '#FFECBA', // apricot — warm but dialed back from the full orange push
  danger:  '#E3CAEF', // lilac — clearer purple than the old gray-lavender
  sky:     '#BCDDEC', // crisper sky, quieter than the saturated blue
  success: '#B5E0CA', // mint — fresher than before, not neon
};

/** Dark-mode card background colors indexed by shadow type */
// Match the light palette hue-for-hue at dark-friendly lightness — each card
// should still read as coral / apricot / lilac / sky / mint, just muted.
export const CARD_BG_DARK: Record<DropShadowBoxType, string> = {
  default: '#2A2520',
  accent:  '#5A2E23',
  warning: '#4A3618',
  danger:  '#3D2048',
  sky:     '#1A3E5A',
  success: '#1A4538',
};

/** Subtle tint of each card bg — used for skeleton bars and any decorative
 * shape that should sit barely-darker than the card while staying in the
 * same hue family. Kept gentle so skeletons read as ghosted, not heavy. */
export const CARD_BAR_LIGHT: Record<DropShadowBoxType, string> = {
  default: '#F0E5D0',
  accent:  '#F0CCC0',
  warning: '#F8E1A8',
  danger:  '#D8C1E6',
  sky:     '#AFD3E3',
  success: '#A8D6BE',
};

/** Dark-mode variant of CARD_BAR_LIGHT. Bars sit barely-lighter than card
 * bg so they remain visible without shouting. */
export const CARD_BAR_DARK: Record<DropShadowBoxType, string> = {
  default: '#342E28',
  accent:  '#6A3A2E',
  warning: '#5A4224',
  danger:  '#4A2A58',
  sky:     '#234A68',
  success: '#225240',
};

/** Neutral fallback bar tint used when a card has no pastel bg to derive
 * from (e.g. plain-theme skeletons). Translucent so it reads on any surface. */
export const SKELETON_BAR_FALLBACK_LIGHT = 'rgba(0,0,0,0.08)';
export const SKELETON_BAR_FALLBACK_DARK = 'rgba(255,255,255,0.12)';

/** Shimmer sweep highlight — translucent white band that drifts across a
 * skeleton bar. Kept whisper-soft so a glance at the screen won't catch it
 * mid-sweep; only a focused look reveals the motion. */
export const SHIMMER_HIGHLIGHT_LIGHT = 'rgba(255,255,255,0.20)';
export const SHIMMER_HIGHLIGHT_DARK = 'rgba(255,255,255,0.06)';

type DropShadowBoxProps = {
  children: React.ReactNode;
  containerClassName?: string;
};

const DropShadowBox = ({
  children,
  containerClassName,
}: DropShadowBoxProps) => (
  <View
    className={`rounded-3xl shadow-card dark:shadow-none ${containerClassName ?? ''}`}
  >
    {children}
  </View>
);

export default DropShadowBox;
