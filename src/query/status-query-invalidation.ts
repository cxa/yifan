import type { QueryClient, QueryKey } from '@tanstack/react-query';

const isStatusRelatedQueryKey = (queryKey: QueryKey) => {
  if (queryKey.length === 0) {
    return false;
  }

  const [root, scope] = queryKey;
  if (root === 'timeline') {
    return true;
  }
  if (root === 'my-timeline' || root === 'favorites' || root === 'photos') {
    return true;
  }
  if (root === 'profile' && scope === 'recent-statuses') {
    return true;
  }
  if (root === 'status' && (scope === 'detail' || scope === 'context')) {
    return true;
  }
  return false;
};

export const invalidateStatusRelatedQueries = async (
  queryClient: QueryClient,
) => {
  await queryClient.invalidateQueries({
    predicate: query => isStatusRelatedQueryKey(query.queryKey),
  });
};
