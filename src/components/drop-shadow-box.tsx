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
 * Order alternates warm/cool to give scrolling a temperature rhythm:
 * warm → cool → warm → cool → cool, with the final cool pair (mint/lilac)
 * sitting across the color wheel from each other so they still read distinct. */
export const CARD_PASTEL_CYCLE: DropShadowBoxType[] = [
  'accent',   // coral  — warm
  'sky',      // sky    — cool
  'warning',  // apricot — warm
  'success',  // mint   — cool
  'danger',   // lilac  — cool, complementary to mint
];

/** Light-mode pastel card background colors indexed by shadow type */
// Each hue has its own personality — widen the hue spread (coral / apricot /
// lilac / crisp sky / spring mint) and push saturation so they stop reading
// as "five slightly different warm pastels" and start reading as five
// distinct flavors. Slight lightness variance adds rhythm when scrolling.
export const CARD_BG_LIGHT: Record<DropShadowBoxType, string> = {
  default: '#F7EFE0',
  accent:  '#FFD6CA', // coral — softer than pure salmon to stop it burning on white
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
