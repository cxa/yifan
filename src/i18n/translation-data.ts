export const SUPPORTED_LOCALES = ['en-US', 'zh-CN'] as const;

export type LocaleKey = (typeof SUPPORTED_LOCALES)[number];

const baseTranslations = {
  brandName: 'Fanfou',
  heroTitle: 'A calmer way to read the timeline.',
  heroSubtitle:
    'Built for focus, crafted for speed, and ready for iOS and Android.',
  cardTitle: 'Coming online soon',
  cardCopy: "We're stitching the essentials: login, timeline, and posting.",
  chipTimeline: 'Chronological timeline',
  chipMentions: 'Smart mentions',
  chipPhotoPosting: 'Photo-first posting',
  ctaSignIn: 'Sign in with Fanfou',
  noticeSignIn: 'OAuth sign-in will land here next.',
} as const;

export type TranslationKey = keyof typeof baseTranslations;

export const RESOURCES = {
  'en-US': {
    translation: baseTranslations,
  },
  'zh-CN': {
    translation: {
      brandName: '饭否',
      heroTitle: '更平静地阅读时间线。',
      heroSubtitle: '为专注而生，速度优先，iOS 与 Android 即将就绪。',
      cardTitle: '即将上线',
      cardCopy: '我们正在拼好基础能力：登录、时间线和发布。',
      chipTimeline: '时间顺序时间线',
      chipMentions: '智能提及',
      chipPhotoPosting: '以图片为先的发布',
      ctaSignIn: '使用饭否登录',
      noticeSignIn: 'OAuth 登录稍后会接入。',
    },
  },
} as const;

export const DEFAULT_LOCALE: LocaleKey = 'en-US';

export const normalizeLocaleTag = (value: string) => value.replace('_', '-');
