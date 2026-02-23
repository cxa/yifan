import React from 'react';
import { View } from 'react-native';
import { Spinner } from 'heroui-native';

import { useAuthSession } from '@/auth/auth-session';

type AuthLayoutProps = {
  children?: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const auth = useAuthSession();

  if (auth.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner size="sm" color="default" />
      </View>
    );
  }

  return children;
};

export default AuthLayout;
