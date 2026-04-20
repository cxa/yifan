import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useThemeColor } from 'heroui-native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import {
  AUTH_MESSAGES_ROUTE,
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
  LOGIN_STACK_ROUTE,
  ROOT_STACK_ROUTE,
} from '@/navigation/route-names';
import { isNativeScrollEdgeEffectAvailable } from '@/navigation/native-scroll-edge';
import { useAppFontFamily } from '@/settings/app-font-preference';
import type {
  AuthMessagesStackParamList,
  AuthProfileStackParamList,
  AuthStackParamList,
  AuthStatusStackParamList,
  AuthTagStackParamList,
  LoginStackParamList,
  RootStackParamList,
} from '@/navigation/types';
import { useAuthSession } from '@/auth/auth-session';
import { showVariantToast } from '@/utils/toast-alert';
import { executeComposerSend, validateComposerContent } from '@/utils/composer-send';
import { useStatusUpdateMutation } from '@/query/post-mutations';
import ComposerModal, {
  type ComposerModalSubmitPayload,
} from '@/components/composer-modal';
import { clearShareIntent, useShareIntentStore } from '@/stores/share-intent-store';
import AuthFavoritesRoute from '@/routes/auth-favorites-screen';
import AuthEditProfileRoute from '@/routes/auth-edit-profile-screen';
import AuthHomeTabsRoute from '@/routes/auth-tabs-screen';
import AuthLayout from '@/routes/auth-layout';
import AuthMyTimelineRoute from '@/routes/auth-my-timeline-screen';
import AuthMessagesRoute from '@/routes/auth-messages-screen';
import AuthPhotosRoute from '@/routes/auth-photos-screen';
import AuthProfileRoute from '@/routes/auth-profile-screen';
import AuthStatusRoute from '@/routes/auth-status-screen';
import AuthTagRoute from '@/routes/auth-tag-timeline-screen';
import AuthPublicTimelineRoute from '@/routes/auth-public-timeline-screen';
import AuthSearchRoute from '@/routes/auth-search-screen';
import AuthUserListRoute from '@/routes/auth-user-list-screen';
import LoginRoute from '@/routes/login-screen';
import OnboardingRoute from '@/routes/onboarding-screen';
import { useShareIntent } from '@/hooks/use-share-intent';
import { useTranslation } from 'react-i18next';
import type { PickedImage } from '@/utils/pick-image-from-library';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const LoginStack = createNativeStackNavigator<LoginStackParamList>();
const MessagesStack = createNativeStackNavigator<AuthMessagesStackParamList>();
const ProfileStack = createNativeStackNavigator<AuthProfileStackParamList>();
const StatusStack = createNativeStackNavigator<AuthStatusStackParamList>();
const TagStack = createNativeStackNavigator<AuthTagStackParamList>();

const HEADER_TITLE_FONT_SIZE = 17;

const AUTH_NATIVE_HEADER_ROUTES = new Set<keyof AuthStackParamList>([
  AUTH_STACK_ROUTE.MY_TIMELINE,
  AUTH_STACK_ROUTE.MESSAGES,
  AUTH_STACK_ROUTE.FAVORITES,
  AUTH_STACK_ROUTE.PHOTOS,
  AUTH_STACK_ROUTE.USER_LIST,
  AUTH_STACK_ROUTE.PROFILE,
  AUTH_STACK_ROUTE.EDIT_PROFILE,
  AUTH_STACK_ROUTE.STATUS,
  AUTH_STACK_ROUTE.PUBLIC_TIMELINE,
  AUTH_STACK_ROUTE.SEARCH,
]);
const TAG_NATIVE_HEADER_ROUTES = new Set<keyof AuthTagStackParamList>([
  AUTH_TAG_TIMELINE_ROUTE.DETAIL,
]);

const buildNativeHeaderOptions = (
  enabled: boolean,
  headerFontFamily: string | undefined,
  foreground: string,
) => {
  if (!enabled) {
    return { headerShown: false } satisfies NativeStackNavigationOptions;
  }
  return {
    headerShown: true,
    headerLargeTitle: false,
    headerTransparent: true,
    headerStyle: { backgroundColor: 'transparent' },
    headerTintColor: foreground,
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    // Top uses 'automatic' so it fades cleanly beneath the transparent
    // navbar; bottom uses 'soft' to force a visible fade even without a
    // toolbar to hide behind.
    scrollEdgeEffects: isNativeScrollEdgeEffectAvailable
      ? { top: 'automatic', bottom: 'soft' }
      : undefined,
    headerTitleStyle: {
      fontFamily: headerFontFamily,
      fontSize: HEADER_TITLE_FONT_SIZE,
      fontWeight: '800',
      color: foreground,
    },
  } satisfies NativeStackNavigationOptions;
};

const LoginStackNavigator = () => (
  <LoginStack.Navigator initialRouteName={LOGIN_STACK_ROUTE.INDEX}>
    <LoginStack.Screen
      name={LOGIN_STACK_ROUTE.INDEX}
      component={LoginRoute}
      options={{ headerShown: false }}
    />
  </LoginStack.Navigator>
);

const MessagesStackNavigator = () => (
  <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
    <MessagesStack.Screen
      name={AUTH_MESSAGES_ROUTE.LIST}
      component={AuthMessagesRoute}
    />
  </MessagesStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen
      name={AUTH_PROFILE_ROUTE.DETAIL}
      component={AuthProfileRoute}
    />
  </ProfileStack.Navigator>
);

const StatusStackNavigator = () => (
  <StatusStack.Navigator screenOptions={{ headerShown: false }}>
    <StatusStack.Screen
      name={AUTH_STATUS_ROUTE.DETAIL}
      component={AuthStatusRoute}
    />
  </StatusStack.Navigator>
);

const TagStackNavigator = () => {
  const headerFontFamily = useAppFontFamily();
  const [foreground] = useThemeColor(['foreground']);

  return (
    <TagStack.Navigator
      screenOptions={({ route }) =>
        buildNativeHeaderOptions(
          TAG_NATIVE_HEADER_ROUTES.has(route.name),
          headerFontFamily,
          foreground,
        )
      }
    >
      <TagStack.Screen
        name={AUTH_TAG_TIMELINE_ROUTE.DETAIL}
        component={AuthTagRoute}
      />
    </TagStack.Navigator>
  );
};

const ShareIntentComposer = () => {
  const { t } = useTranslation();
  const auth = useAuthSession();
  const shareIntent = useShareIntentStore();
  const statusUpdateMutation = useStatusUpdateMutation();
  const [visible, setVisible] = useState(false);
  const [initialPhoto, setInitialPhoto] = useState<PickedImage | null>(null);
  const [initialText, setInitialText] = useState('');

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    if (shareIntent.photo) {
      setInitialPhoto(shareIntent.photo);
      setVisible(true);
      clearShareIntent();
    } else if (shareIntent.text) {
      setInitialText(shareIntent.text);
      setVisible(true);
      clearShareIntent();
    }
  }, [shareIntent.photo, shareIntent.text, auth.status]);

  const handleClose = () => {
    setVisible(false);
    setInitialPhoto(null);
    setInitialText('');
  };
  const handleSubmit = ({ text, photo }: ComposerModalSubmitPayload) => {
    const hasPhoto = Boolean(photo?.base64);
    const trimmedText = validateComposerContent(text, hasPhoto, t('postFailedTitle'));
    if (trimmedText === null) return;
    setVisible(false);
    setInitialPhoto(null);
    setInitialText('');
    executeComposerSend(
      () =>
        statusUpdateMutation.mutateAsync({
          status: photo?.base64 ? trimmedText || undefined : trimmedText,
          photoBase64: photo?.base64,
          photoMimeType: photo?.mimeType,
          photoFileName: photo?.fileName,
        }),
      t('postFailedTitle'),
      () => showVariantToast('success', t('sentTitle'), t('postPendingReviewMessage')),
    );
  };

  return (
    <ComposerModal
      visible={visible}
      title={t('composerWritePost')}
      placeholder={t('composerWhatsNew')}
      submitLabel={t('composerSubmitPost')}
      enablePhoto
      resetKey={`share-intent-${initialPhoto ? 'photo' : initialText ? 'text' : 'idle'}`}
      initialText={initialText}
      initialPhoto={initialPhoto}
      isSubmitting={false}
      onCancel={handleClose}
      onSubmit={handleSubmit}
    />
  );
};

const AuthStackNavigator = () => {
  const headerFontFamily = useAppFontFamily();
  const [foreground, background] = useThemeColor(['foreground', 'background']);
  useShareIntent();

  return (
    <AuthLayout>
      <AuthStack.Navigator
        initialRouteName={AUTH_STACK_ROUTE.TABS}
        screenOptions={({ route }) =>
          buildNativeHeaderOptions(
            AUTH_NATIVE_HEADER_ROUTES.has(route.name),
            headerFontFamily,
            foreground,
          )
        }
      >
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.TABS}
          component={AuthHomeTabsRoute}
          options={{ headerShown: false, contentStyle: { backgroundColor: background } }}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.MY_TIMELINE}
          component={AuthMyTimelineRoute}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.MESSAGES}
          component={MessagesStackNavigator}
          options={{ title: 'Private messages' }}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.FAVORITES}
          component={AuthFavoritesRoute}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.PHOTOS}
          component={AuthPhotosRoute}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.USER_LIST}
          component={AuthUserListRoute}
          options={({ route }) => ({
            title:
              route.params.mode === 'following' ? 'Following' : 'Followers',
          })}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.PROFILE}
          component={ProfileStackNavigator}
          options={{ title: 'Profile' }}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.EDIT_PROFILE}
          component={AuthEditProfileRoute}
          options={{ title: 'Edit profile' }}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.STATUS}
          component={StatusStackNavigator}
          options={{ title: 'Status' }}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.TAG_TIMELINE}
          component={TagStackNavigator}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.PUBLIC_TIMELINE}
          component={AuthPublicTimelineRoute}
        />
        <AuthStack.Screen
          name={AUTH_STACK_ROUTE.SEARCH}
          component={AuthSearchRoute}
        />
      </AuthStack.Navigator>
      <ShareIntentComposer />
    </AuthLayout>
  );
};

const AppNavigator = () => (
  <NavigationContainer>
    <RootStack.Navigator initialRouteName={ROOT_STACK_ROUTE.AUTH}>
      <RootStack.Screen
        name={ROOT_STACK_ROUTE.AUTH}
        component={AuthStackNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name={ROOT_STACK_ROUTE.LOGIN}
        component={LoginStackNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name={ROOT_STACK_ROUTE.ONBOARDING}
        component={OnboardingRoute}
        options={{ headerShown: false, animation: 'fade' }}
      />
    </RootStack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
