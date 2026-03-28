import { createContext, useContext } from 'react';

export type ThemeTransitionCallback = () => void | Promise<void>;

export const ThemeTransitionContext = createContext<{
  prepareSnapshot: () => void;
  requestTransition: (fn: ThemeTransitionCallback) => void;
}>({
  prepareSnapshot: () => {},
  requestTransition: fn => { fn(); },
});

export const useThemeTransition = () => useContext(ThemeTransitionContext);
