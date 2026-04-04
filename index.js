/**
 * @format
 */

import 'react-native-gesture-handler';

// react-native-safe-area-context and react-native-screens ship old-arch
// (Paper) event classes compiled unconditionally alongside their Fabric
// counterparts. In RN 0.84 bridgeless mode the legacy RCTEventEmitter
// callable module is never registered, causing a fatal dev-overlay on
// startup. The actual events are delivered correctly via Fabric; this error
// is a false alarm that only appears in debug builds.
if (__DEV__) {
  const { LogBox } = require('react-native');
  LogBox.ignoreLogs(['RCTEventEmitter.receiveEvent']);
}

import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-relativetimeformat/polyfill';
import '@formatjs/intl-relativetimeformat/dist/include-aliases';
import '@formatjs/intl-relativetimeformat/dist/locale-data/en';
import '@formatjs/intl-relativetimeformat/dist/locale-data/zh';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/en';
import '@formatjs/intl-pluralrules/locale-data/zh';
import { AppRegistry } from 'react-native';
import { featureFlags } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

// Enable synchronous Fabric shadow-tree state updates for RNSScreen.
// Without this, `updateBounds` (called from `viewDidLayoutSubviews` on
// rotation) posts an *async* state update.  On iPad, Dimensions.change fires
// before viewDidLayoutSubviews, so JS re-renders commit a shadow tree that
// resets RNSScreen's Yoga size back to portrait — causing persistent
// portrait-width layout in landscape.  Synchronous mode ensures the native
// landscape bounds are committed atomically before any JS re-render can race
// against them.
featureFlags.experiment.synchronousScreenUpdatesEnabled = true;

AppRegistry.registerComponent(appName, () => App);
