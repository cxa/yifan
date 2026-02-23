import React from 'react';
import { Platform } from 'react-native';
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
import AuthUserListRoute from '@/routes/auth-user-list-screen';
import LoginRoute from '@/routes/login-screen';

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
    headerTransparent: Platform.OS === 'ios',
    headerTintColor: foreground,
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    scrollEdgeEffects: isNativeScrollEdgeEffectAvailable
      ? { top: 'automatic' }
      : undefined,
    headerTitleStyle: {
      fontFamily: headerFontFamily,
      fontSize: HEADER_TITLE_FONT_SIZE,
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

const AuthStackNavigator = () => {
  const headerFontFamily = useAppFontFamily();
  const [foreground] = useThemeColor(['foreground']);

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
          options={{ headerShown: false }}
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
      </AuthStack.Navigator>
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
    </RootStack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
