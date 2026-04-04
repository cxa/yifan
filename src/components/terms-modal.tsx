import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/app-text';
import { useAppFontFamily } from '@/settings/app-font-preference';
import type { TranslationKey } from '@/i18n/translation-data';

type TermsModalProps = {
  isOpen: boolean;
  onAgree: () => void;
  onDecline: () => void;
};

const renderWithItalic = (text: string, fontFamily?: string) => {
  const parts = text.split(/(\*[^*]+\*)/);
  if (parts.length === 1) {
    return text;
  }
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={i} className="text-[13px] leading-5 text-muted italic" style={fontFamily ? { fontFamily } : undefined}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return part;
  });
};

type TermsSection =
  | { headingKey: null; bodyKey: TranslationKey }
  | { headingKey: TranslationKey; bodyKey: TranslationKey };

const TERMS_SECTIONS: TermsSection[] = [
  { headingKey: null, bodyKey: 'termsIntro' },
  { headingKey: 'termsUgcHeading', bodyKey: 'termsUgcBody' },
  { headingKey: 'termsZeroToleranceHeading', bodyKey: 'termsZeroToleranceBody' },
  { headingKey: 'termsBlockingHeading', bodyKey: 'termsBlockingBody' },
  { headingKey: 'termsReportingHeading', bodyKey: 'termsReportingBody' },
  { headingKey: 'termsAgeHeading', bodyKey: 'termsAgeBody' },
  { headingKey: null, bodyKey: 'termsFooter' },
];

const TermsModal = ({ isOpen, onAgree, onDecline }: TermsModalProps) => {
  const { t } = useTranslation();
  const fontFamily = useAppFontFamily();

  return (
    <Dialog isOpen={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-foreground/55 dark:bg-background/85" isCloseOnPress={false} />
        <Dialog.Content className="w-[92%] max-w-[400px] self-center rounded-3xl bg-surface px-5 py-5" isSwipeable={false}>
          <Dialog.Title
            className="text-[20px] leading-[26px] font-bold text-foreground mb-3"
            style={fontFamily ? { fontFamily } : undefined}
          >
            {t('termsTitle')}
          </Dialog.Title>

          <View className="h-[340px]">
            <ScrollView
              showsVerticalScrollIndicator
              contentContainerStyle={styles.scrollContent}
            >
              {TERMS_SECTIONS.map((section, index) => (
                <View key={index} className={index > 0 ? 'mt-4' : undefined}>
                  {section.headingKey ? (
                    <Text
                      className="text-[14px] font-bold text-foreground mb-1"
                      style={fontFamily ? { fontFamily } : undefined}
                    >
                      {t(section.headingKey)}
                    </Text>
                  ) : null}
                  <Text
                    className="text-[13px] leading-5 text-muted"
                    style={fontFamily ? { fontFamily } : undefined}
                  >
                    {renderWithItalic(t(section.bodyKey), fontFamily)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={onDecline}
              className="flex-1 items-center justify-center rounded-2xl bg-danger-soft px-3 py-3 active:opacity-75"
              accessibilityRole="button"
              accessibilityLabel={t('termsDecline')}
            >
              <Text
                className="text-[14px] font-semibold text-danger"
                style={fontFamily ? { fontFamily } : undefined}
              >
                {t('termsDecline')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onAgree}
              className="flex-[2] items-center justify-center rounded-2xl bg-accent px-3 py-3 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={t('termsAgree')}
            >
              <Text
                className="text-[14px] font-bold text-accent-foreground"
                style={fontFamily ? { fontFamily } : undefined}
              >
                {t('termsAgree')}
              </Text>
            </Pressable>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 8,
  },
});

export default TermsModal;
