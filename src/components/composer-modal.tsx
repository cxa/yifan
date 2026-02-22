import React, { useMemo } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useThemeColor } from 'heroui-native';

import { Text } from '@/components/app-text';

type ComposerModalProps = {
  visible: boolean;
  title: string;
  placeholder: string;
  submitLabel: string;
  value: string;
  isSubmitting: boolean;
  topInset: number;
  photoUri?: string | null;
  isPhotoPicking?: boolean;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPickPhoto?: () => void;
  onRemovePhoto?: () => void;
};

const ComposerModal = ({
  visible,
  title,
  placeholder,
  submitLabel,
  value,
  isSubmitting,
  topInset,
  photoUri,
  isPhotoPicking = false,
  onChangeText,
  onCancel,
  onSubmit,
  onPickPhoto,
  onRemovePhoto,
}: ComposerModalProps) => {
  const [placeholderColor] = useThemeColor(['muted']);
  const canDismiss = !isSubmitting && !isPhotoPicking;
  const containerStyle = useMemo(
    () => ({ marginTop: Math.max(topInset + 20, 40) }),
    [topInset],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <Pressable className="flex-1 bg-foreground/45 dark:bg-background/85 px-[18px] pb-6">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <Pressable
            onPress={event => event.stopPropagation()}
            className="border border-border bg-surface p-[14px] gap-[10px]"
            style={containerStyle}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text
                className="text-[22px] leading-[28px] font-semibold text-foreground"
                dynamicTypeRamp="title2"
              >
                {title}
              </Text>
              <Pressable
                onPress={canDismiss ? onCancel : undefined}
                className="border border-border bg-surface-secondary px-3 py-2"
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text className="text-[13px] text-foreground">Cancel</Text>
              </Pressable>
            </View>
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={placeholderColor}
              multiline
              autoFocus
              className="min-h-[120px] max-h-[260px] border border-border bg-surface-secondary px-2.5 py-2 text-[15px] text-foreground"
              editable={!isSubmitting}
            />

            {photoUri ? (
              <View className="overflow-hidden border border-border bg-surface-secondary">
                <Image
                  source={{ uri: photoUri }}
                  className="h-[180px] w-full bg-surface-secondary"
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <View className="flex-row gap-2">
                {onPickPhoto ? (
                  <Pressable
                    onPress={
                      canDismiss && !isPhotoPicking ? onPickPhoto : undefined
                    }
                    className="border border-border bg-surface-secondary px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={
                      photoUri ? 'Change photo' : 'Attach photo'
                    }
                  >
                    <Text className="text-[13px] text-foreground">
                      {isPhotoPicking
                        ? 'Choosing...'
                        : photoUri
                        ? 'Change photo'
                        : 'Attach photo'}
                    </Text>
                  </Pressable>
                ) : null}

                {photoUri && onRemovePhoto ? (
                  <Pressable
                    onPress={canDismiss ? onRemovePhoto : undefined}
                    className="border border-border bg-surface-secondary px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Text className="text-[13px] text-foreground">Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={!isSubmitting ? onSubmit : undefined}
                  className="border border-border bg-accent px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={submitLabel}
                >
                  <Text className="text-[13px] text-accent-foreground">
                    {isSubmitting ? 'Sending...' : submitLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

export default ComposerModal;
