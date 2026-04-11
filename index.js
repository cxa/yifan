/**
 * @format
 */

import 'react-native-gesture-handler';

import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-relativetimeformat/polyfill';
import '@formatjs/intl-relativetimeformat/locale-data/en';
import '@formatjs/intl-relativetimeformat/locale-data/zh';
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

// react-native-screens and react-native-safe-area-context unconditionally
// call RCTEventEmitter.receiveEvent() via the old-arch notification path even
// under Fabric/bridgeless. In RN 0.84 bridgeless mode that module is never
// registered, which throws a fatal error. Register a no-op so those calls
// succeed; Fabric delivers the real events through its own system.
global.__fbBatchedBridge?.registerCallableModule('RCTEventEmitter', {
  receiveEvent: () => {},
  receiveTouches: () => {},
});

AppRegistry.registerComponent(appName, () => App);
