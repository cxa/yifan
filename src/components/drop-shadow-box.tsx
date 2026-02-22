import React from 'react';
import { View } from 'react-native';
import { $ } from '@cxa/twx';

export type DropShadowBoxType =
  | 'default'
  | 'danger'
  | 'warning'
  | 'success'
  | 'accent';

type DropShadowBoxProps = {
  children: React.ReactNode;
  type?: DropShadowBoxType;
  containerClassName?: string;
  shadowClassName?: string;
  shadowOffsetClassName?: string;
};

const SHADOW_CLASS_BY_TYPE: Record<DropShadowBoxType, string> = {
  default: 'bg-foreground dark:bg-border',
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
  accent: 'bg-accent',
};

const BORDER_CLASS_BY_TYPE: Record<DropShadowBoxType, string> = {
  default: 'border-foreground dark:border-border',
  danger: 'border-danger',
  warning: 'border-warning',
  success: 'border-success',
  accent: 'border-accent',
};

export const getDropShadowBorderClass = (type: DropShadowBoxType) =>
  BORDER_CLASS_BY_TYPE[type];

const DropShadowBox = ({
  children,
  type = 'default',
  containerClassName,
  shadowClassName,
  shadowOffsetClassName = '-translate-x-2 translate-y-2',
}: DropShadowBoxProps) => (
  <View className={$('relative', containerClassName)}>
    <View
      className={$(
        'absolute left-0 top-0 h-full w-full',
        shadowOffsetClassName,
        SHADOW_CLASS_BY_TYPE[type],
        shadowClassName,
      )}
    />
    {children}
  </View>
);

export default DropShadowBox;
