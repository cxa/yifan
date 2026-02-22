import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import QueryProvider from '@/query/query-provider';

type RootLayoutProps = {
  children?: React.ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <GestureHandlerRootView className="flex-1">
      <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
        <QueryProvider>
          <SafeAreaProvider>{children}</SafeAreaProvider>
        </QueryProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
