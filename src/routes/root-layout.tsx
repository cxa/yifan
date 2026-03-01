import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import ToastManagerSync from '@/components/toast-manager-sync';
import QueryProvider from '@/query/query-provider';

type RootLayoutProps = {
  children?: React.ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <HeroUINativeProvider
          config={{ devInfo: { stylingPrinciples: false } }}
        >
          <ToastManagerSync />
          <QueryProvider>{children}</QueryProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
