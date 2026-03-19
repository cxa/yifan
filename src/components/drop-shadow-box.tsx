import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

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

const DropShadowBox = ({
  children,
  containerClassName,
}: DropShadowBoxProps) => (
  <View className={containerClassName}>{children}</View>
);

export default DropShadowBox;
