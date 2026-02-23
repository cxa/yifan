import React from 'react';
import '@/i18n/i18n-setup';

import AppNavigator from '@/navigation/app-navigator';
import RootLayout from '@/routes/root-layout';

import './global.css';

const App = () => {
  return (
    <RootLayout>
      <AppNavigator />
    </RootLayout>
  );
};

export default App;
