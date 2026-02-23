import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, useThemeColor } from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/auth/auth-session';
import { get, post } from '@/auth/fanfou-client';
import { Text, TextInput } from '@/components/app-text';
import DropShadowBox, {
  getDropShadowBorderClass,
} from '@/components/drop-shadow-box';
import NativeEdgeScrollShadow from '@/components/native-edge-scroll-shadow';
import type { AuthStackParamList } from '@/navigation/types';
import type { FanfouUser } from '@/types/fanfou';
import { parseHtmlToText } from '@/utils/parse-html';

const PAGE_HORIZONTAL_PADDING = 20;
const PAGE_BOTTOM_PADDING = 24;
const PAGE_TOP_PADDING = 16;
const PAGE_SECTION_GAP = 20;
const FORM_FIELD_GAP = 12;
const FORM_LABEL_CLASS = 'text-[12px] uppercase tracking-[1px] text-muted';
const INPUT_CLASS =
  'border border-border bg-surface-secondary px-2.5 py-2 text-[15px] text-foreground';

const getUserById = async (userId: string): Promise<FanfouUser> => {
  return get('/users/show', { id: userId }) as Promise<FanfouUser>;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const EditProfileRoute = () => {
  const auth = useAuthSession();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const queryClient = useQueryClient();
  const [accent, background, muted] = useThemeColor([
    'accent',
    'background',
    'muted',
  ]);
  const insets = useSafeAreaInsets();

  const userId = auth.accessToken?.userId ?? null;
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    data: user,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<FanfouUser>({
    queryKey: ['account', userId],
    queryFn: () => getUserById(userId as string),
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

  const errorMessage = error
    ? getErrorMessage(error, 'Unable to load profile details.')
    : null;

  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: PAGE_HORIZONTAL_PADDING,
      paddingTop: PAGE_TOP_PADDING,
      paddingBottom: insets.bottom + PAGE_BOTTOM_PADDING,
      gap: PAGE_SECTION_GAP,
    }),
    [insets.bottom],
  );

  const handleSave = useCallback(async () => {
    if (!userId || isSaving) {
      return;
    }

    const nextName = name.trim();
    if (!nextName) {
      Alert.alert('Cannot save', 'Display name is required.');
      return;
    }

    setIsSaving(true);
    try {
      await post('/account/update_profile', {
        name: nextName,
        location: location.trim() || undefined,
        url: url.trim() || undefined,
        description: description.trim() || undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: ['account', userId],
      });
      navigation.goBack();
    } catch (updateError) {
      Alert.alert(
        'Update failed',
        getErrorMessage(updateError, 'Unable to update profile.'),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    description,
    isSaving,
    location,
    name,
    navigation,
    queryClient,
    url,
    userId,
  ]);

  if (!userId) {
    return (
      <View className="flex-1 bg-background px-6 pt-8">
        <Surface className="bg-danger-soft px-4 py-3">
          <Text className="text-[13px] text-danger-foreground">
            Missing authenticated user.
          </Text>
        </Surface>
      </View>
    );
  }

  return (
    <NativeEdgeScrollShadow className="flex-1 bg-background" color={background}>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={contentContainerStyle}
      >
        {!isInitialized && isLoading ? (
          <DropShadowBox>
            <Surface className="bg-surface border-2 border-foreground dark:border-border px-5 py-6">
              <View className="flex-row items-center gap-3">
                <ActivityIndicator color={accent} />
                <Text className="text-[14px] text-foreground">
                  Loading profile...
                </Text>
              </View>
            </Surface>
          </DropShadowBox>
        ) : null}

        {!user && !isLoading ? (
          <DropShadowBox type="danger" containerClassName="pb-2">
            <Surface
              className={`bg-surface border-2 ${getDropShadowBorderClass(
                'danger',
              )} px-4 py-3`}
            >
              <Text className="text-[13px] text-danger">
                {errorMessage ?? 'Unable to load profile details.'}
              </Text>
              <View className="mt-3">
                <Pressable
                  onPress={() => {
                    refetch().catch(() => undefined);
                  }}
                  className="self-start border border-danger bg-danger-soft px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading profile"
                >
                  <Text className="text-[12px] text-danger">Retry</Text>
                </Pressable>
              </View>
            </Surface>
          </DropShadowBox>
        ) : null}

        {user ? (
          <>
            <DropShadowBox>
              <Surface className="bg-surface border-2 border-foreground dark:border-border px-5 py-6">
                <View style={{ gap: FORM_FIELD_GAP }}>
                  <View className="gap-1">
                    <Text className={FORM_LABEL_CLASS}>Display name</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Your display name"
                      placeholderTextColor={muted}
                      className={INPUT_CLASS}
                      editable={!isSaving}
                    />
                  </View>

                  <View className="gap-1">
                    <Text className={FORM_LABEL_CLASS}>Location</Text>
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Where are you?"
                      placeholderTextColor={muted}
                      className={INPUT_CLASS}
                      editable={!isSaving}
                    />
                  </View>

                  <View className="gap-1">
                    <Text className={FORM_LABEL_CLASS}>Website</Text>
                    <TextInput
                      value={url}
                      onChangeText={setUrl}
                      placeholder="https://example.com"
                      placeholderTextColor={muted}
                      autoCapitalize="none"
                      keyboardType="url"
                      className={INPUT_CLASS}
                      editable={!isSaving}
                    />
                  </View>

                  <View className="gap-1">
                    <Text className={FORM_LABEL_CLASS}>Bio</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Tell people about yourself"
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
                className={`w-full h-14 items-center justify-center border-2 border-foreground dark:border-border bg-accent ${
                  isSaving
                    ? 'opacity-70'
                    : 'active:translate-x-[-3px] active:translate-y-[3px]'
                }`}
                accessibilityRole="button"
                accessibilityLabel="Save profile"
              >
                <Text className="text-[16px] font-bold text-accent-foreground">
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </DropShadowBox>
          </>
        ) : null}

        {isFetching && user ? (
          <View className="items-center py-1">
            <ActivityIndicator color={accent} />
          </View>
        ) : null}
      </ScrollView>
    </NativeEdgeScrollShadow>
  );
};

export default EditProfileRoute;
