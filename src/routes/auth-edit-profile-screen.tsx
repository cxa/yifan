import React, { useEffect, useState } from 'react';
import { showVariantToast } from '@/utils/toast-alert';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import NeobrutalActivityIndicator from '@/components/neobrutal-activity-indicator';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import ErrorBanner from '@/components/error-banner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/auth/auth-session';
import { post } from '@/auth/fanfou-client';
import { Text, TextInput } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import type { AuthStackParamList } from '@/navigation/types';
import {
  accountUserQueryOptions,
  userQueryKeys,
} from '@/query/user-query-options';
import type { FanfouUser } from '@/types/fanfou';
import { parseHtmlToText } from '@/utils/parse-html';
import { useTranslation } from 'react-i18next';
import { useReadableContentInsets } from '@/navigation/readable-content-guide';
const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 24;
const PAGE_TOP_PADDING = 16;
const PAGE_SECTION_GAP = 20;
const FORM_FIELD_GAP = 12;
const FORM_LABEL_CLASS = 'text-[12px] uppercase tracking-[1px] text-muted';
const INPUT_CLASS =
  'border  bg-surface-secondary px-2.5 py-2 text-[15px] text-foreground';
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const EditProfileRoute = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const queryClient = useQueryClient();
  const [background, muted] = useThemeColor(['background', 'muted']);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const userId = auth.accessToken?.userId ?? null;
  const accountUserId = userId ?? '';
  const accountUserQueryKey = userQueryKeys.account(accountUserId);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...accountUserQueryOptions(accountUserId),
    enabled: Boolean(userId),
    retry: 1,
    refetchOnMount: 'always',
  });
  useEffect(() => {
    if (!user || isInitialized) {
      return;
    }
    setName((user.name || user.screen_name).trim());
    setLocation((user.location || '').trim());
    setUrl(parseHtmlToText(user.url || '').trim());
    setDescription(parseHtmlToText(user.description || '').trim());
    setIsInitialized(true);
  }, [isInitialized, user]);
  const errorMessage = error ? t('editProfileLoadFailed') : null;
  const technicalError = error instanceof Error ? error.message : null;
  const topPadding =
    Platform.OS === 'android'
      ? headerHeight + PAGE_TOP_PADDING
      : PAGE_TOP_PADDING;
  const readableInsets = useReadableContentInsets();
  const contentContainerStyle = {
    paddingHorizontal: Math.max(PAGE_HORIZONTAL_PADDING, readableInsets.left),
    paddingTop: topPadding,
    paddingBottom: insets.bottom + PAGE_BOTTOM_PADDING,
    gap: PAGE_SECTION_GAP,
  };
  const formScrollView = (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      contentContainerStyle={contentContainerStyle}
    >
      {!isInitialized && isLoading ? (
        <DropShadowBox>
          <Surface className="bg-surface-secondary px-5 py-6">
            <View className="flex-row items-center gap-3">
              <NeobrutalActivityIndicator size="small" />
              <Text className="text-[14px] text-foreground">
                {t('editProfileLoading')}
              </Text>
            </View>
          </Surface>
        </DropShadowBox>
      ) : null}

      {!user && !isLoading ? (
        <View className="pb-2 gap-3">
          <ErrorBanner message={errorMessage ?? t('editProfileLoadFailed')} technicalDetail={technicalError} />
          <Pressable
            onPress={() => {
              refetch().catch(() => undefined);
            }}
            className="self-start rounded-xl border bg-danger-soft px-3 py-2 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t('editProfileRetry')}
          >
            <Text className="text-[12px] text-danger">
              {t('editProfileRetry')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {user ? (
        <>
          <DropShadowBox>
            <Surface className="bg-surface-secondary px-5 py-6">
              <View
                style={{
                  gap: FORM_FIELD_GAP,
                }}
              >
                <View className="gap-1">
                  <Text className={FORM_LABEL_CLASS}>
                    {t('editProfileName')}
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t('editProfileNamePlaceholder')}
                    placeholderTextColor={muted}
                    className={INPUT_CLASS}
                    editable={!isSaving}
                  />
                </View>

                <View className="gap-1">
                  <Text className={FORM_LABEL_CLASS}>
                    {t('editProfileLocation')}
                  </Text>
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder={t('editProfileLocationPlaceholder')}
                    placeholderTextColor={muted}
                    className={INPUT_CLASS}
                    editable={!isSaving}
                  />
                </View>

                <View className="gap-1">
                  <Text className={FORM_LABEL_CLASS}>
                    {t('editProfileWebsite')}
                  </Text>
                  <TextInput
                    value={url}
                    onChangeText={setUrl}
                    placeholder={t('editProfileWebsitePlaceholder')}
                    placeholderTextColor={muted}
                    autoCapitalize="none"
                    keyboardType="url"
                    className={INPUT_CLASS}
                    editable={!isSaving}
                  />
                </View>

                <View className="gap-1">
                  <Text className={FORM_LABEL_CLASS}>
                    {t('editProfileBio')}
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('editProfileBioPlaceholder')}
                    placeholderTextColor={muted}
                    multiline
                    textAlignVertical="top"
                    className={`min-h-[120px] ${INPUT_CLASS}`}
                    editable={!isSaving}
                  />
                </View>
              </View>
            </Surface>
          </DropShadowBox>

          <DropShadowBox
            containerClassName="w-full"
            shadowOffsetClassName="-translate-x-1.5 translate-y-1.5"
          >
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              className={`w-full h-14 items-center justify-center bg-accent ${isSaving
                  ? 'opacity-70'
                  : 'active:translate-x-[-3px] active:translate-y-[3px]'
                }`}
              accessibilityRole="button"
              accessibilityLabel={t('editProfileSave')}
              accessibilityState={{
                disabled: isSaving,
                busy: isSaving,
              }}
            >
              {isSaving ? (
                <NeobrutalActivityIndicator size="small" />
              ) : (
                <Text className="text-[16px] font-bold text-accent-foreground">
                  {t('editProfileSave')}
                </Text>
              )}
            </Pressable>
          </DropShadowBox>
        </>
      ) : null}
    </ScrollView>
  );
  async function handleSave() {
    if (!userId || isSaving) {
      return;
    }
    const nextName = name.trim();
    const nextLocation = location.trim();
    const nextUrl = url.trim();
    const nextDescription = description.trim();
    if (!nextName) {
      showVariantToast(
        'danger',
        t('editProfileSaveFailedTitle'),
        t('editProfileNameRequired'),
      );
      return;
    }
    setIsSaving(true);
    try {
      await post('/account/update_profile', {
        name: nextName,
        location: nextLocation || undefined,
        url: nextUrl || undefined,
        description: nextDescription || undefined,
      });
      queryClient.setQueryData<FanfouUser | undefined>(
        accountUserQueryKey,
        previous =>
          previous
            ? {
              ...previous,
              name: nextName,
              location: nextLocation,
              url: nextUrl,
              description: nextDescription,
            }
            : previous,
      );
      await queryClient.invalidateQueries({
        queryKey: accountUserQueryKey,
      });
      showVariantToast(
        'success',
        t('successTitle'),
        t('editProfilePendingReviewMessage'),
      );
      navigation.goBack();
    } catch (updateError) {
      showVariantToast(
        'danger',
        t('editProfileUpdateFailedTitle'),
        getErrorMessage(updateError, t('editProfileUpdateFailed')),
      );
    } finally {
      setIsSaving(false);
    }
  }
  if (!userId) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <ErrorBanner message={t('notLoggedIn')} />
      </View>
    );
  }
  return (
    <NativeEdgeScrollShadow className="flex-1 bg-background" color={background}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          {formScrollView}
        </KeyboardAvoidingView>
      ) : (
        formScrollView
      )}
    </NativeEdgeScrollShadow>
  );
};
export default EditProfileRoute;
