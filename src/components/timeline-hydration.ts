type TimelineHydrationOptions<T> = {
  isLoading: boolean;
  renderedItems: readonly T[];
  sourceItems: readonly T[] | null | undefined;
};

export const isHydratingTimeline = <T>({
  isLoading,
  renderedItems,
  sourceItems,
}: TimelineHydrationOptions<T>): boolean =>
  !isLoading && renderedItems.length === 0 && Boolean(sourceItems?.length);
