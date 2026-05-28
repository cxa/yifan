import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Spinner } from 'heroui-native';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/auth/auth-session';
import { friendsListQueryOptions } from '@/query/user-query-options';

type AuthLayoutProps = {
  children?: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const auth = useAuthSession();
  const userId = auth.accessToken?.userId ?? '';
  const queryClient = useQueryClient();

  // Kick off the friends-list crawl as soon as the user is authenticated so
  // @-mention autocomplete in the composer has data ready immediately.
  // prefetchQuery respects staleTime (4 h) and won't re-crawl within that window.
  useEffect(() => {
    if (!userId) return;
    queryClient.prefetchQuery(friendsListQueryOptions(userId));
  }, [userId, queryClient]);

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
