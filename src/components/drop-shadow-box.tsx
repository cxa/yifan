import React from 'react';
import { Platform, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export type DropShadowBoxType =
  | 'default'
  | 'danger'
  | 'warning'
  | 'success'
  | 'accent'
  | 'sky';

/** Rotate through warm pastel card backgrounds for visual variety in lists */
export const CARD_PASTEL_CYCLE: DropShadowBoxType[] = [
  'accent',   // #FDDBD5 soft pink
  'warning',  // #FDF3C8 warm yellow
  'danger',   // #E8D5F5 lavender
  'sky',      // #D0E8F5 sky blue
  'success',  // #C8EDE8 mint
];

/** Light-mode pastel card background colors indexed by shadow type */
export const CARD_BG_LIGHT: Record<DropShadowBoxType, string> = {
  default: '#F7EFE0',
  accent:  '#FDDBD5',
  warning: '#FDF3C8',
  danger:  '#E8D5F5',
  sky:     '#D0E8F5',
  success: '#C8EDE8',
};

/** Dark-mode card background colors indexed by shadow type */
export const CARD_BG_DARK: Record<DropShadowBoxType, string> = {
  default: '#2A2520',
  accent:  '#3D2820',
  warning: '#352E18',
  danger:  '#2D1E38',
  sky:     '#1A2E3D',
  success: '#1A3530',
};

type DropShadowBoxProps = {
  children: React.ReactNode;
  type?: DropShadowBoxType;
  containerClassName?: string;
  shadowClassName?: string;
  shadowOffsetClassName?: string;
  shadowStyle?: StyleProp<ViewStyle>;
};

const BORDER_CLASS_BY_TYPE: Record<DropShadowBoxType, string> = {
  default: '',
  danger: '',
  warning: '',
  success: '',
  accent: '',
  sky: '',
};

export const getDropShadowBorderClass = (type: DropShadowBoxType) =>
  BORDER_CLASS_BY_TYPE[type];

const CARD_SHADOW: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#1A1208',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  default: {
    elevation: 2,
  },
});

const DropShadowBox = ({
  children,
  containerClassName,
}: DropShadowBoxProps) => (
  <View className={containerClassName} style={CARD_SHADOW}>
    {children}
  </View>
);

export default DropShadowBox;
