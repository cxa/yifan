import React, { useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

// React Query needs the host to tell it when the app foregrounds and when the
// network reconnects — neither is detected by default in RN. Wire both at
// module scope so the listeners install once per process, not per provider
// mount.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', status => {
    focusManager.setFocused(status === 'active');
  });
}

onlineManager.setEventListener(setOnline =>
  NetInfo.addEventListener(state => {
    // On Android cold start NetInfo can fire with `isConnected: null` while
    // it is still resolving. Coercing `null` to `false` flips onlineManager
    // to offline, so the home timeline's first fetch (and every pull-to-
    // refresh during that window) gets paused — the user sees an empty
    // screen until NetInfo eventually reports `true`. Only update when we
    // have a definite boolean; keep React Query on its default-online state
    // until NetInfo gives a real answer.
    if (state.isConnected === true || state.isConnected === false) {
      setOnline(state.isConnected);
    }
  }),
);

type QueryProviderProps = {
  children?: React.ReactNode;
};

const QueryProvider = ({ children }: QueryProviderProps) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            // Foreground refetch stays opt-in per query; the focusManager
            // wiring above only matters for queries that explicitly enable it.
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

export default QueryProvider;
