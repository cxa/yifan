import React, { useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  focusManager,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

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

// Only the friends list is persisted — it's the only query whose cold-start
// latency is visible to the user (@ autocomplete in the composer). Timeline
// and profile queries are intentionally excluded: they're fast to refetch and
// stale data would be confusing.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'YIFAN_FRIENDS_CACHE',
});

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

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        // Bump buster when the shape of persisted data changes so old
        // AsyncStorage cache is discarded on next start. 'contacts-v2' encodes
        // the current shape: concurrent batch fetching, page-size 60, max 100 pages.
        buster: 'contacts-v2',
        dehydrateOptions: {
          shouldDehydrateQuery: query =>
            query.queryKey[0] === 'friends-list' && query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};

export default QueryProvider;
