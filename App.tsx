import React from 'react';
import { Platform, StatusBar, useColorScheme } from 'react-native';
import '@/i18n/i18n-setup';

import AppNavigator from '@/navigation/app-navigator';
import RootLayout from '@/routes/root-layout';

import './global.css';

const App = () => {
  const isDark = useColorScheme() === 'dark';
  return (
    <RootLayout>
      {Platform.OS === 'android' && (
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      )}
      <AppNavigator />
    </RootLayout>
  );
};

export default App;
