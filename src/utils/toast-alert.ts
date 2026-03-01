type ToastActionHelpers = {
  hide: (ids?: string | string[] | 'all') => void;
};

type ToastVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

type ToastButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type ToastManagerLike = {
  show: (options: {
    label?: string;
    description?: string;
    variant?: ToastVariant;
    actionLabel?: string;
    duration?: number | 'persistent';
    onActionPress?: (helpers: ToastActionHelpers) => void;
  }) => string;
};

let toastManager: ToastManagerLike | null = null;

export const setToastManager = (manager: ToastManagerLike | null) => {
  toastManager = manager;
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
  },
) => {
  if (!toastManager) {
    return;
  }

  const actionButton = pickActionButton(buttons);
  const hasAction = Boolean(actionButton?.text);

  toastManager.show({
    label: title,
    description: message,
    variant:
      options?.variant ??
      (actionButton?.style === 'destructive' ? 'danger' : 'default'),
    actionLabel: actionButton?.text,
    duration: hasAction ? 'persistent' : undefined,
    onActionPress: actionButton?.onPress
      ? ({ hide }) => {
          hide();
          actionButton.onPress?.();
        }
      : undefined,
  });
};
