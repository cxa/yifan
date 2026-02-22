import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthHomeStackParamList = {
  'route_root._auth.home.index': undefined;
};

export type AuthMentionsStackParamList = {
  'route_root._auth.mentions.index': undefined;
};

export type AuthMoreStackParamList = {
  'route_root._auth.more.index': undefined;
};

export type AuthProfileStackParamList = {
  'route_root._auth.profile._handle': { userId: string };
};

export type AuthProfileScreenParamList = {
  'route_root._auth.profile._handle.index': { userId: string };
};

export type AuthStatusStackParamList = {
  'route_root._auth.status._statusId': { statusId: string };
};

export type AuthStatusScreenParamList = {
  'route_root._auth.status._statusId.index': { statusId: string };
};

export type AuthTagStackParamList = {
  'route_root._auth.tag._tag': { tag: string };
};

export type AuthTagScreenParamList = {
  'route_root._auth.tag._tag.index': { tag: string };
};

export type AuthStackParamList = {
  'route_root._auth.home':
    | NavigatorScreenParams<AuthHomeStackParamList>
    | undefined;
  'route_root._auth.index': undefined;
  'route_root._auth.mentions':
    | NavigatorScreenParams<AuthMentionsStackParamList>
    | undefined;
  'route_root._auth.more':
    | NavigatorScreenParams<AuthMoreStackParamList>
    | undefined;
  'route_root._auth.profile': NavigatorScreenParams<AuthProfileStackParamList>;
  'route_root._auth.status': NavigatorScreenParams<AuthStatusStackParamList>;
  'route_root._auth.tag': NavigatorScreenParams<AuthTagStackParamList>;
};

export type LoginStackParamList = {
  'route_root.login.index': undefined;
};

export type RootStackParamList = {
  'route_root._auth': NavigatorScreenParams<AuthStackParamList> | undefined;
  'route_root.login': NavigatorScreenParams<LoginStackParamList> | undefined;
};

export type AuthTabParamList = {
  Home: undefined;
  Mentions: undefined;
  Compose: undefined;
  More: undefined;
};
