import React from 'react';
import { Pressable } from 'react-native';

import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import { $ } from '@cxa/twx';

type AuthActionVariant = 'primary' | 'danger';

type AuthActionButtonProps = {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  variant?: AuthActionVariant;
  onPress: () => void;
};

const backgroundClassMap: Record<AuthActionVariant, string> = {
  primary: 'bg-accent',
  danger: 'bg-danger',
};

const labelClassMap: Record<AuthActionVariant, string> = {
  primary: 'text-accent-foreground',
  danger: 'text-danger-foreground',
};

const AuthActionButton = ({
  label,
  loadingLabel,
  isLoading = false,
  variant = 'primary',
  onPress,
}: AuthActionButtonProps) => {
  const text = isLoading ? loadingLabel ?? label : label;

  return (
    <DropShadowBox
      containerClassName="w-full"
      shadowOffsetClassName="-translate-x-1.5 translate-y-1.5"
    >
      <Pressable
        onPress={onPress}
        disabled={isLoading}
        className={`w-full ${
          backgroundClassMap[variant]
        } border-2 border-foreground dark:border-border h-14 items-center justify-center active:translate-x-[-3px] active:translate-y-[3px] ${
          isLoading ? 'opacity-70' : ''
        }`}
      >
        <Text className={$('text-[16px] font-bold', labelClassMap[variant])}>
          {text}
        </Text>
      </Pressable>
    </DropShadowBox>
  );
};

export default AuthActionButton;
