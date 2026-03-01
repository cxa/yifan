export type PhotoViewerOriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ShouldUsePhotoSharedTransitionParams = {
  originRect?: PhotoViewerOriginRect | null;
  viewportHeight: number;
  topInset: number;
  bottomOccludedHeight?: number;
  scrollShadowSize?: number;
};

export const shouldUsePhotoSharedTransition = ({
  originRect,
  viewportHeight,
  topInset,
  bottomOccludedHeight = 0,
  scrollShadowSize = 0,
}: ShouldUsePhotoSharedTransitionParams) => {
  if (!originRect) {
    return false;
  }
  const hasValidRect =
    Number.isFinite(originRect.x) &&
    Number.isFinite(originRect.y) &&
    Number.isFinite(originRect.width) &&
    Number.isFinite(originRect.height) &&
    originRect.width > 0 &&
    originRect.height > 0;
  if (!hasValidRect) {
    return false;
  }
  const rectTop = originRect.y;
  const rectBottom = originRect.y + originRect.height;
  const topShadowBottom = topInset + Math.max(0, scrollShadowSize);
  const bottomShadowTop =
    viewportHeight -
    Math.max(0, bottomOccludedHeight) -
    Math.max(0, scrollShadowSize);
  const tabBarTop = viewportHeight - Math.max(0, bottomOccludedHeight);
  const isUnderTopShadow = rectTop < topShadowBottom;
  const isUnderBottomShadow = rectBottom > bottomShadowTop;
  const isBehindTabBar = bottomOccludedHeight > 0 && rectBottom > tabBarTop;
  return !(isUnderTopShadow || isUnderBottomShadow || isBehindTabBar);
};
