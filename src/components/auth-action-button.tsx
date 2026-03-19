import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/app-text';
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
    <View className="w-full">
      <Pressable
        onPress={onPress}
        disabled={isLoading}
        className={`w-full ${backgroundClassMap[variant]
          } h-14 items-center justify-center rounded-[24px] active:opacity-75 ${isLoading ? 'opacity-70' : ''
          }`}
      >
        <Text className={$('text-[16px] font-bold', labelClassMap[variant])}>
          {text}
        </Text>
      </Pressable>
    </View>
  );
};

export default AuthActionButton;
