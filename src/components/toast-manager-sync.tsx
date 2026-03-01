import { useEffect } from 'react';
import { useToast } from 'heroui-native';
import { setToastManager } from '@/utils/toast-alert';

const ToastManagerSync = () => {
  const { toast } = useToast();

  useEffect(() => {
    setToastManager(toast);
    return () => {
      setToastManager(null);
    };
  }, [toast]);

  return null;
};

export default ToastManagerSync;
