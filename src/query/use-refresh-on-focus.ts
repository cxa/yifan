import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

// Refetch the given queries when a screen regains focus, but skip the very
// first focus (which fires on mount, when the query is already fetching).
// React Navigation's `useFocusEffect` is the documented helper, but it
// requires `useCallback` which this codebase bans (React Compiler).
// `useIsFocused` + `useEffect` reaches the same outcome and the compiler
// memoizes the effect for us.
export const useRefreshOnFocus = (queryKey: QueryKey) => {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const firstTimeRef = useRef(true);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    if (firstTimeRef.current) {
      firstTimeRef.current = false;
      return;
    }
    queryClient.refetchQueries({ queryKey, stale: true, type: 'active' });
  }, [isFocused, queryClient, queryKey]);
};
