import { useSyncExternalStore } from 'react';

type Listener = () => void;
export type PhotoViewerLayerMode = 'default' | 'viewer-open' | 'viewer-closing';

const listeners = new Set<Listener>();
let photoViewerLayerMode: PhotoViewerLayerMode = 'default';

const emitChange = () => {
  listeners.forEach(listener => listener());
};

export const setPhotoViewerLayerMode = (next: PhotoViewerLayerMode) => {
  if (photoViewerLayerMode === next) {
    return;
  }
  photoViewerLayerMode = next;
  emitChange();
};

export const setPhotoViewerAboveTabBar = (next: boolean) => {
  setPhotoViewerLayerMode(next ? 'viewer-open' : 'default');
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => photoViewerLayerMode;

export const usePhotoViewerLayerMode = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const usePhotoViewerAboveTabBar = () =>
  usePhotoViewerLayerMode() === 'viewer-open';
