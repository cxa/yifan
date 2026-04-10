import React from 'react';
import { View } from 'react-native';
import { Toast } from 'heroui-native';
import { Text } from '@/components/app-text';
import { getAppFontClassNameSnapshot } from '@/settings/app-font-preference';

type ToastActionHelpers = {
  hide: (ids?: string | string[] | 'all') => void;
};

type ToastVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

type ToastButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type ToastShowOptions = {
  component: (props: unknown) => React.ReactElement;
  duration?: number | 'persistent';
};

type ToastManagerLike = {
  show: (options: ToastShowOptions) => string;
  hide: (ids?: string | string[] | 'all') => void;
};

let toastManager: ToastManagerLike | null = null;

export const setToastManager = (manager: ToastManagerLike | null) => {
  toastManager = manager;
};

export const hideToast = (id?: string | string[] | 'all') => {
  toastManager?.hide(id);
};

const pickActionButton = (buttons?: ToastButton[]) => {
  if (!buttons || buttons.length === 0) {
    return null;
  }
  const nonCancelButtons = buttons.filter(button => button.style !== 'cancel');
  if (nonCancelButtons.length === 0) {
    return null;
  }
  const withHandler = nonCancelButtons.find(
    button => typeof button.onPress === 'function',
  );
  return withHandler ?? nonCancelButtons[0];
};

export const showToastAlert = (
  title?: string,
  message?: string,
  buttons?: ToastButton[],
  options?: {
    cancelable?: boolean;
    variant?: ToastVariant;
    placement?: 'top' | 'bottom';
  },
): string | undefined => {
  if (!toastManager) {
    return;
  }

  const actionButton = pickActionButton(buttons);
  const hasAction = Boolean(actionButton?.text);
  const variant =
    options?.variant ??
    (actionButton?.style === 'destructive' ? 'danger' : 'default');
  const placement = options?.placement;
  const fontClassName = getAppFontClassNameSnapshot();

  return toastManager.show({
    duration: hasAction ? 'persistent' : undefined,
    component: toastProps => {
      const rootProps = toastProps as React.ComponentProps<typeof Toast>;
      const helpers = toastProps as ToastActionHelpers;

      return (
        <Toast {...rootProps} variant={variant} placement={placement} className="flex-row gap-3">
          <View className="flex-1">
            {title ? (
              <Toast.Title className={fontClassName}>{title}</Toast.Title>
            ) : null}
            {message ? (
              <Toast.Description className={fontClassName}>
                {message}
              </Toast.Description>
            ) : null}
          </View>
          {actionButton?.text ? (
            <Toast.Action
              onPress={() => {
                helpers.hide();
                actionButton.onPress?.();
              }}
            >
              <Text className={fontClassName}>{actionButton.text}</Text>
            </Toast.Action>
          ) : null}
        </Toast>
      );
    },
  });
};

export const showProgressToast = (title: string): string | undefined => {
  if (!toastManager) return;
  const fontClassName = getAppFontClassNameSnapshot();
  return toastManager.show({
    duration: 'persistent',
    component: toastProps => {
      const rootProps = toastProps as React.ComponentProps<typeof Toast>;
      return (
        <Toast {...rootProps} placement="top" className="flex-row gap-3 items-center">
          <Toast.Title className={fontClassName}>{title}</Toast.Title>
        </Toast>
      );
    },
  });
};

export const showVariantToast = (
  variant: ToastVariant,
  title?: string,
  message?: string,
  buttons?: ToastButton[],
  options?: {
    cancelable?: boolean;
    placement?: 'top' | 'bottom';
  },
): string | undefined => {
  return showToastAlert(title, message, buttons, {
    ...options,
    variant,
  });
};
