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

/** Warm "printed paper" stock color — used for elements that should read as
 * pasted-on paper (postage stamps, notes) sitting atop a pastel card. Kept
 * slightly warmer than pure white so it doesn't read as a harsh chip. */
export const PAPER_STOCK_LIGHT = '#FDFBF5';
export const PAPER_STOCK_DARK = '#3A342E';

/** Faint ruled-line ink for letter/note paper. Low-saturation blue so the
 * rules recede behind text — they should read as notebook lines, not dividers. */
export const RULED_LINE_INK_LIGHT = 'rgba(90, 135, 200, 0.22)';
export const RULED_LINE_INK_DARK = 'rgba(130, 170, 220, 0.18)';

/** Per-category "colored ink" used to draw rules/marks on cream paper that
 * visually belong to the card's pastel flavor. A saturated mid-tone of each
 * hue at low alpha — reads as a faded fountain-pen stroke, not as the pastel
 * fill (which would vanish against paper). */
export const CARD_INK_ON_PAPER_LIGHT: Record<DropShadowBoxType, string> = {
  default: 'rgba(138, 106, 75, 0.35)',
  accent:  'rgba(216, 90, 72, 0.32)',
  warning: 'rgba(196, 144, 64, 0.38)',
  danger:  'rgba(153, 104, 196, 0.32)',
  sky:     'rgba(71, 136, 179, 0.35)',
  success: 'rgba(74, 155, 120, 0.38)',
};
export const CARD_INK_ON_PAPER_DARK: Record<DropShadowBoxType, string> = {
  default: 'rgba(220, 180, 130, 0.25)',
  accent:  'rgba(255, 170, 150, 0.25)',
  warning: 'rgba(255, 210, 140, 0.28)',
  danger:  'rgba(210, 170, 240, 0.25)',
  sky:     'rgba(150, 200, 240, 0.28)',
  success: 'rgba(170, 230, 200, 0.28)',
};

/** Stronger variant of CARD_INK_ON_PAPER for punctuating marks (tear-lines,
 * postmark dots) that need to read as separators rather than recede like the
 * body rules. Same hue, higher alpha. */
export const CARD_INK_ON_PAPER_STRONG_LIGHT: Record<DropShadowBoxType, string> = {
  default: 'rgba(138, 106, 75, 0.55)',
  accent:  'rgba(216, 90, 72, 0.50)',
  warning: 'rgba(196, 144, 64, 0.58)',
  danger:  'rgba(153, 104, 196, 0.50)',
  sky:     'rgba(71, 136, 179, 0.55)',
  success: 'rgba(74, 155, 120, 0.58)',
};
export const CARD_INK_ON_PAPER_STRONG_DARK: Record<DropShadowBoxType, string> = {
  default: 'rgba(220, 180, 130, 0.45)',
  accent:  'rgba(255, 170, 150, 0.45)',
  warning: 'rgba(255, 210, 140, 0.48)',
  danger:  'rgba(210, 170, 240, 0.45)',
  sky:     'rgba(150, 200, 240, 0.48)',
  success: 'rgba(170, 230, 200, 0.48)',
};

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
