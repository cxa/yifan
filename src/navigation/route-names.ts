export const ROOT_STACK_ROUTE = {
  AUTH: 'Auth',
  LOGIN: 'Login',
  ONBOARDING: 'Onboarding',
} as const;

export const AUTH_STACK_ROUTE = {
  TABS: 'Home',
  MY_TIMELINE: 'MyTimeline',
  MESSAGES: 'Messages',
  FAVORITES: 'Favorites',
  PHOTOS: 'Photos',
  USER_LIST: 'UserList',
  PROFILE: 'Profile',
  EDIT_PROFILE: 'EditProfile',
  STATUS: 'Status',
  TAG_TIMELINE: 'TagTimeline',
  PUBLIC_TIMELINE: 'PublicTimeline',
  SEARCH: 'Search',
} as const;

export const AUTH_MESSAGES_ROUTE = {
  LIST: 'MessagesList',
} as const;

export const AUTH_PROFILE_ROUTE = {
  DETAIL: 'ProfileDetail',
} as const;

export const AUTH_STATUS_ROUTE = {
  DETAIL: 'StatusDetail',
} as const;

export const AUTH_TAG_TIMELINE_ROUTE = {
  DETAIL: 'TagTimelineDetail',
} as const;

export const LOGIN_STACK_ROUTE = {
  INDEX: 'LoginIndex',
} as const;

export const AUTH_TAB_ROUTE = {
  HOME: 'Home',
  MENTIONS: 'Mentions',
  COMPOSE: 'Compose',
  MORE: 'More',
} as const;
