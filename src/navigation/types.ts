import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DropShadowBoxType } from '@/components/drop-shadow-box';
import {
  AUTH_MESSAGES_ROUTE,
  AUTH_PROFILE_ROUTE,
  AUTH_STACK_ROUTE,
  AUTH_STATUS_ROUTE,
  AUTH_TAG_TIMELINE_ROUTE,
  AUTH_TAB_ROUTE,
  LOGIN_STACK_ROUTE,
  ROOT_STACK_ROUTE,
} from '@/navigation/route-names';

export type AuthMessagesStackParamList = {
  [AUTH_MESSAGES_ROUTE.LIST]: undefined;
};

export type AuthProfileStackParamList = {
  [AUTH_PROFILE_ROUTE.DETAIL]: { userId: string };
};

export type AuthStatusStackParamList = {
  [AUTH_STATUS_ROUTE.DETAIL]: { statusId: string; shadowType?: DropShadowBoxType };
};

export type AuthTagStackParamList = {
  [AUTH_TAG_TIMELINE_ROUTE.DETAIL]: { tag: string };
};

export type AuthStackParamList = {
  [AUTH_STACK_ROUTE.TABS]: undefined;
  [AUTH_STACK_ROUTE.MY_TIMELINE]:
    | { userId: string; backCount?: number }
    | undefined;
  [AUTH_STACK_ROUTE.MESSAGES]:
    | NavigatorScreenParams<AuthMessagesStackParamList>
    | undefined;
  [AUTH_STACK_ROUTE.FAVORITES]:
    | { userId: string; backCount?: number }
    | undefined;
  [AUTH_STACK_ROUTE.PHOTOS]: { userId: string; backCount?: number } | undefined;
  [AUTH_STACK_ROUTE.USER_LIST]: {
    userId: string;
    mode: 'following' | 'followers';
    backCount?: number;
  };
  [AUTH_STACK_ROUTE.PROFILE]: NavigatorScreenParams<AuthProfileStackParamList>;
  [AUTH_STACK_ROUTE.EDIT_PROFILE]: undefined;
  [AUTH_STACK_ROUTE.STATUS]: NavigatorScreenParams<AuthStatusStackParamList>;
  [AUTH_STACK_ROUTE.TAG_TIMELINE]: NavigatorScreenParams<AuthTagStackParamList>;
  [AUTH_STACK_ROUTE.PUBLIC_TIMELINE]: undefined;
};

export type LoginStackParamList = {
  [LOGIN_STACK_ROUTE.INDEX]: undefined;
};

export type RootStackParamList = {
  [ROOT_STACK_ROUTE.AUTH]:
    | NavigatorScreenParams<AuthStackParamList>
    | undefined;
  [ROOT_STACK_ROUTE.LOGIN]:
    | NavigatorScreenParams<LoginStackParamList>
    | undefined;
  [ROOT_STACK_ROUTE.ONBOARDING]: undefined;
};

export type AuthTabParamList = {
  [AUTH_TAB_ROUTE.HOME]: undefined;
  [AUTH_TAB_ROUTE.MENTIONS]: undefined;
  [AUTH_TAB_ROUTE.COMPOSE]: undefined;
  [AUTH_TAB_ROUTE.MORE]: undefined;
};
