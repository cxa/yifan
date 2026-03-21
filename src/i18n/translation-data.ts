export type LocaleKey = 'en-US' | 'zh-CN';

export const SUPPORTED_LOCALES: ReadonlyArray<LocaleKey> = ['en-US', 'zh-CN'];

type BaseTranslations = {
  // Login screen
  loginButton: string;
  loginLoading: string;
  loginCancel: string;
  loginFailed: string;
  loginErrorTimeout: string;
  loginErrorCancelled: string;
  loginErrorNetwork: string;
  errorTechnicalDetails: string;
  errorHideDetails: string;

  // Tab labels
  tabHome: string;
  tabMentions: string;
  tabMore: string;
  tabCompose: string;

  // Composer
  composerWritePost: string;
  composerWhatsNew: string;
  composerReply: string;
  composerReplyTo: string;
  composerRepost: string;
  composerRepostTo: string;
  composerReplyPlaceholder: string;
  composerCommentPlaceholder: string;
  composerSubmitReply: string;
  composerSubmitRepost: string;
  composerSubmitPost: string;
  composerSending: string;
  composerCancel: string;
  composerAttachPhoto: string;
  composerChangePhoto: string;
  composerRemovePhoto: string;
  composerRemovePhotoA11y: string;
  composerPhotoError: string;

  // Post/send results
  sentTitle: string;
  replySent: string;
  repostSent: string;
  postPendingReviewMessage: string;
  replyFailedTitle: string;
  repostFailedTitle: string;
  postFailedTitle: string;
  retryMessage: string;

  // Reply errors
  cannotReplyTitle: string;
  replyMissingTarget: string;
  replyNeedsContent: string;
  cannotRepostTitle: string;
  repostMissingTarget: string;

  // Bookmark
  bookmarkFailedTitle: string;
  statusDeleteTitle: string;
  statusDeleteConfirm: string;
  statusDeleteConfirmButton: string;
  statusDeleting: string;
  statusDeleteSuccess: string;
  statusDeleteFailedTitle: string;
  statusDeleteFailedMessage: string;

  // Home screen
  homeTitle: string;
  homeEmpty: string;
  homeLoadFailed: string;

  // Mentions screen
  mentionsTitle: string;
  mentionsEmpty: string;
  mentionsLoadFailed: string;

  // My timeline screen
  myTimelineTitle: string;
  timelineTitle: string;
  myTimelineEmpty: string;
  timelineLoadFailed: string;

  // Photos screen
  photosTitle: string;
  photosEmpty: string;
  photosLoadFailed: string;

  // Favorites screen
  favoritesTitle: string;
  favoritesEmpty: string;
  favoritesLoadFailed: string;

  // Status screen
  statusLoadFailed: string;
  conversationLoadFailed: string;
  statusMissingId: string;
  conversationLoading: string;

  // Tag timeline screen
  tagTimelineTitle: string;
  tagTimelineFallbackTitle: string;
  tagTimelineEmpty: string;
  tagTimelineLoadFailed: string;
  tagMissing: string;

  // User list screen
  followingTitle: string;
  followersTitle: string;
  followingTitleOther: string;
  followersTitleOther: string;
  followingEmpty: string;
  followersEmpty: string;
  followingEmptyOther: string;
  followersEmptyOther: string;
  userListLoadFailed: string;

  // Profile screen
  profileStatPosts: string;
  profileStatFollowing: string;
  profileStatFollowers: string;
  profileStatFollowingOther: string;
  profileStatFollowersOther: string;
  profileStatFavorites: string;
  profileStatPhotos: string;
  recentActivity: string;
  recentActivityEmpty: string;
  protectedAccountNotice: string;
  profileLoadFailed: string;
  profileActionMention: string;
  profileActionMessage: string;
  profileActionFollow: string;
  profileActionUnfollow: string;
  profileActionBlock: string;
  profileActionUnblock: string;
  profileActionChecking: string;
  profileActionUpdating: string;
  profileFollowSuccess: string;
  profileUnfollowSuccess: string;
  profileBlockSuccess: string;
  profileUnblockSuccess: string;
  profileFollowFailed: string;
  profileBlockFailed: string;
  profileMentionComposerTitle: string;
  profileMessageComposerTitle: string;
  profileMessagePlaceholder: string;
  profileMentionSent: string;
  profileMessageSent: string;
  profileSendFailed: string;
  profileSendFailedMessage: string;
  profileNeedsContent: string;
  cannotSendTitle: string;

  // Messages screen
  messagesTitle: string;
  messagesInbox: string;
  messagesOutbox: string;
  messagesInboxEmpty: string;
  messagesOutboxEmpty: string;
  messagesLoadFailed: string;
  messageDeleteTitle: string;
  messageDeleteConfirm: string;
  messageDeleteCancel: string;
  messageDeleteConfirmButton: string;
  messageDeleteFailed: string;
  messageDeleteFailedMessage: string;
  messageReplyFailed: string;
  messageReplyFailedMessage: string;
  messageReplyPlaceholder: string;
  messageReplyComposerTitle: string;
  messageSend: string;
  cannotSendMessageTitle: string;
  messageNeedsContent: string;

  // More screen
  morePrivateMessages: string;
  morePrivateMessagesHelper: string;
  moreSignOut: string;
  moreSigningOut: string;
  moreSignOutConfirmTitle: string;
  moreSignOutConfirmMessage: string;
  moreFontStyle: string;
  moreFontSize: string;
  moreFontOptionSystem: string;
  moreFontSizeXS: string;
  moreFontSizeSM: string;
  moreFontSizeMD: string;
  moreFontSizeLG: string;
  moreFontSizeXL: string;
  moreLanguage: string;
  moreLanguageSystemDefault: string;
  moreTheme: string;
  moreThemeColorful: string;
  moreThemePlain: string;
  moreFontUpdateFailed: string;
  moreFontUpdateFailedMessage: string;
  moreStyle: string;
  moreStyleSoft: string;
  moreStyleSharp: string;
  moreFollowProfile: string;
  moreFollowProfileHint: string;
  moreAccountLoading: string;
  moreAccountLoadFailed: string;
  moreAccountLoadFailedNoId: string;

  // Edit profile screen
  editProfileLoading: string;
  editProfileLoadFailed: string;
  editProfileRetry: string;
  editProfileName: string;
  editProfileNamePlaceholder: string;
  editProfileLocation: string;
  editProfileLocationPlaceholder: string;
  editProfileWebsite: string;
  editProfileWebsitePlaceholder: string;
  editProfileBio: string;
  editProfileBioPlaceholder: string;
  editProfileSave: string;
  editProfileSaveFailedTitle: string;
  editProfileNameRequired: string;
  editProfileUpdateFailedTitle: string;
  editProfileUpdateFailed: string;
  editProfilePendingReviewMessage: string;

  // Photo viewer
  photoViewerClose: string;
  photoViewerCloseA11y: string;

  // Common
  notLoggedIn: string;
  operationFailed: string;
  successTitle: string;
};

const enUS: BaseTranslations = {
  // Login screen
  loginButton: 'Sign in with Fanfou',
  loginLoading: 'Signing in…',
  loginCancel: 'Cancel',
  loginFailed: 'Sign in failed. Please try again.',
  loginErrorTimeout: 'Sign in timed out. Please try again.',
  loginErrorCancelled: 'Sign in was cancelled.',
  loginErrorNetwork: 'Unable to connect. Check your network and try again.',
  errorTechnicalDetails: 'Technical details',
  errorHideDetails: 'Hide details',

  // Tab labels
  tabHome: 'Home',
  tabMentions: 'Mentions',
  tabMore: 'More',
  tabCompose: 'Post',

  // Composer
  composerWritePost: 'New Post',
  composerWhatsNew: "What's new?",
  composerReply: 'Reply',
  composerReplyTo: 'Reply to @{{name}}',
  composerRepost: 'Repost',
  composerRepostTo: 'Repost @{{name}}',
  composerReplyPlaceholder: 'Write your reply…',
  composerCommentPlaceholder: 'Add a comment (optional)…',
  composerSubmitReply: 'Reply',
  composerSubmitRepost: 'Repost',
  composerSubmitPost: 'Post',
  composerSending: 'Sending…',
  composerCancel: 'Cancel',
  composerAttachPhoto: 'Attach Photo',
  composerChangePhoto: 'Change Photo',
  composerRemovePhoto: 'Remove',
  composerRemovePhotoA11y: 'Remove photo',
  composerPhotoError: 'Cannot attach photo',

  // Post/send results
  sentTitle: 'Sent',
  replySent: 'Reply posted.',
  repostSent: 'Reposted.',
  postPendingReviewMessage:
    'Your post has been sent. Due to content review, it may take 10 minutes or longer to appear.',
  replyFailedTitle: 'Reply Failed',
  repostFailedTitle: 'Repost Failed',
  postFailedTitle: 'Post Failed',
  retryMessage: 'Please try again.',

  // Reply errors
  cannotReplyTitle: 'Cannot Reply',
  replyMissingTarget: 'Missing reply target.',
  replyNeedsContent: 'Please enter text or attach a photo.',
  cannotRepostTitle: 'Cannot Repost',
  repostMissingTarget: 'Missing repost target.',

  // Bookmark
  bookmarkFailedTitle: 'Bookmark Failed',
  statusDeleteTitle: 'Delete Post',
  statusDeleteConfirm: 'Delete this post?',
  statusDeleteConfirmButton: 'Delete',
  statusDeleting: 'Deleting…',
  statusDeleteSuccess: 'Post deleted.',
  statusDeleteFailedTitle: 'Delete Failed',
  statusDeleteFailedMessage: 'Cannot delete post.',

  // Home screen
  homeTitle: 'Home',
  homeEmpty: 'Nothing here yet.',
  homeLoadFailed: 'Failed to load timeline.',

  // Mentions screen
  mentionsTitle: 'Mentions',
  mentionsEmpty: 'No mentions yet.',
  mentionsLoadFailed: 'Failed to load mentions.',

  // My timeline screen
  myTimelineTitle: 'My Posts',
  timelineTitle: 'Timeline',
  myTimelineEmpty: 'No posts yet.',
  timelineLoadFailed: 'Failed to load timeline.',

  // Photos screen
  photosTitle: 'Photos',
  photosEmpty: 'No photos yet.',
  photosLoadFailed: 'Failed to load photos.',

  // Favorites screen
  favoritesTitle: 'Favorites',
  favoritesEmpty: 'No favorites yet.',
  favoritesLoadFailed: 'Failed to load favorites.',

  // Status screen
  statusLoadFailed: 'Failed to load post.',
  conversationLoadFailed: 'Failed to load conversation.',
  statusMissingId: 'Missing post ID.',
  conversationLoading: 'Loading conversation…',

  // Tag timeline screen
  tagTimelineTitle: '#{{tag}}#',
  tagTimelineFallbackTitle: 'Tag Timeline',
  tagTimelineEmpty: 'No posts for this tag.',
  tagTimelineLoadFailed: 'Failed to load tag timeline.',
  tagMissing: 'Missing tag.',

  // User list screen
  followingTitle: 'Following',
  followersTitle: 'Followers',
  followingTitleOther: 'Following',
  followersTitleOther: 'Followers',
  followingEmpty: 'Not following anyone.',
  followersEmpty: 'No followers yet.',
  followingEmptyOther: 'Not following anyone yet.',
  followersEmptyOther: 'No followers yet.',
  userListLoadFailed: 'Failed to load user list.',

  // Profile screen
  profileStatPosts: 'Posts',
  profileStatFollowing: 'Following',
  profileStatFollowers: 'Followers',
  profileStatFollowingOther: 'Following',
  profileStatFollowersOther: 'Followers',
  profileStatFavorites: 'Favorites',
  profileStatPhotos: 'Photos',
  recentActivity: 'Recent Activity',
  recentActivityEmpty: 'No recent activity.',
  protectedAccountNotice:
    'This account is protected. Follow to see recent activity.',
  profileLoadFailed: 'Failed to load profile.',
  profileActionMention: 'Mention',
  profileActionMessage: 'Message',
  profileActionFollow: 'Follow',
  profileActionUnfollow: 'Unfollow',
  profileActionBlock: 'Block',
  profileActionUnblock: 'Unblock',
  profileActionChecking: 'Checking…',
  profileActionUpdating: 'Updating…',
  profileFollowSuccess: 'Now following @{{name}}.',
  profileUnfollowSuccess: 'Unfollowed @{{name}}.',
  profileBlockSuccess: 'Blocked @{{name}}.',
  profileUnblockSuccess: 'Unblocked @{{name}}.',
  profileFollowFailed: 'Failed to update follow status.',
  profileBlockFailed: 'Failed to update block status.',
  profileMentionComposerTitle: 'Mention {{handle}}',
  profileMessageComposerTitle: 'Message {{handle}}',
  profileMessagePlaceholder: 'Write your message…',
  profileMentionSent: 'Mention sent.',
  profileMessageSent: 'Message sent.',
  profileSendFailed: 'Send Failed',
  profileSendFailedMessage: 'Failed to send message.',
  profileNeedsContent: 'Please enter some text.',
  cannotSendTitle: 'Cannot Send',

  // Messages screen
  messagesTitle: 'Messages',
  messagesInbox: 'Inbox',
  messagesOutbox: 'Sent',
  messagesInboxEmpty: 'No messages in inbox.',
  messagesOutboxEmpty: 'No sent messages.',
  messagesLoadFailed: 'Failed to load messages.',
  messageDeleteTitle: 'Delete Message',
  messageDeleteConfirm: 'Delete message from {{name}}?',
  messageDeleteCancel: 'Cancel',
  messageDeleteConfirmButton: 'Delete',
  messageDeleteFailed: 'Delete Failed',
  messageDeleteFailedMessage: 'Cannot delete message.',
  messageReplyFailed: 'Reply Failed',
  messageReplyFailedMessage: 'Failed to send reply.',
  messageReplyPlaceholder: 'Write your reply…',
  messageReplyComposerTitle: 'Reply to @{{name}}',
  messageSend: 'Send',
  cannotSendMessageTitle: 'Cannot Send',
  messageNeedsContent: 'Please enter a message.',

  // More screen
  morePrivateMessages: 'Messages',
  morePrivateMessagesHelper: 'Inbox & Outbox',
  moreSignOut: 'Sign Out',
  moreSigningOut: 'Signing out…',
  moreSignOutConfirmTitle: 'Sign Out',
  moreSignOutConfirmMessage: 'Are you sure you want to sign out?',
  moreFontStyle: 'Font',
  moreFontSize: 'Font Size',
  moreFontOptionSystem: 'System Font',
  moreFontSizeXS: 'Tiny',
  moreFontSizeSM: 'Small',
  moreFontSizeMD: 'Medium',
  moreFontSizeLG: 'Large',
  moreFontSizeXL: 'Huge',
  moreLanguage: 'Language',
  moreLanguageSystemDefault: 'System Default',
  moreTheme: 'Theme',
  moreThemeColorful: 'Colorful',
  moreThemePlain: 'Plain',
  moreFontUpdateFailed: 'Update Failed',
  moreFontUpdateFailedMessage: 'Cannot update font setting.',
  moreStyle: 'Style',
  moreStyleSoft: 'Soft',
  moreStyleSharp: 'Sharp',
  moreFollowProfile: 'Follow User Color Settings',
  moreFollowProfileHint: "If this page looks off, set your background and color scheme on Fanfou's website, or turn off Follow User Color Settings.",
  moreAccountLoading: 'Loading account…',
  moreAccountLoadFailed: 'Failed to load account.',
  moreAccountLoadFailedNoId: 'Cannot load account: missing user ID.',

  // Edit profile screen
  editProfileLoading: 'Loading profile…',
  editProfileLoadFailed: 'Failed to load profile.',
  editProfileRetry: 'Retry',
  editProfileName: 'Name',
  editProfileNamePlaceholder: 'Your name',
  editProfileLocation: 'Location',
  editProfileLocationPlaceholder: 'Where are you?',
  editProfileWebsite: 'Website',
  editProfileWebsitePlaceholder: 'https://example.com',
  editProfileBio: 'Bio',
  editProfileBioPlaceholder: 'Tell us about yourself',
  editProfileSave: 'Save',
  editProfileSaveFailedTitle: 'Cannot Save',
  editProfileNameRequired: 'Name cannot be empty.',
  editProfileUpdateFailedTitle: 'Update Failed',
  editProfileUpdateFailed: 'Failed to update profile.',
  editProfilePendingReviewMessage:
    'Profile update submitted. Due to content review, changes may take 10 minutes or longer to appear.',

  // Photo viewer
  photoViewerClose: 'Close',
  photoViewerCloseA11y: 'Close photo viewer',

  // Common
  notLoggedIn: 'No logged-in user found.',
  operationFailed: 'Operation Failed',
  successTitle: 'Success',
};

const zhCN: BaseTranslations = {
  // Login screen
  loginButton: '使用饭否登录',
  loginLoading: '登录中…',
  loginCancel: '取消',
  loginFailed: '登录失败，请重试。',
  loginErrorTimeout: '登录超时，请重试。',
  loginErrorCancelled: '登录已取消。',
  loginErrorNetwork: '无法连接，请检查网络后重试。',
  errorTechnicalDetails: '技术详情',
  errorHideDetails: '收起详情',

  // Tab labels
  tabHome: '首页',
  tabMentions: '提到我的',
  tabMore: '更多',
  tabCompose: '发布',

  // Composer
  composerWritePost: '新消息',
  composerWhatsNew: '吃了没？',
  composerReply: '回复',
  composerReplyTo: '回复 @{{name}}',
  composerRepost: '转播',
  composerRepostTo: '转播 @{{name}}',
  composerReplyPlaceholder: '写下你的回复…',
  composerCommentPlaceholder: '添加评论（可选）…',
  composerSubmitReply: '回复',
  composerSubmitRepost: '转播',
  composerSubmitPost: '发布',
  composerSending: '发送中…',
  composerCancel: '取消',
  composerAttachPhoto: '附上图片',
  composerChangePhoto: '更换图片',
  composerRemovePhoto: '移除',
  composerRemovePhotoA11y: '移除图片',
  composerPhotoError: '无法附上图片',

  // Post/send results
  sentTitle: '已发送',
  replySent: '回复已发布。',
  repostSent: '已转播。',
  postPendingReviewMessage:
    '你的饭否已发出。由于内容审查，可能需要 10 分钟或更久才会显示。',
  replyFailedTitle: '回复失败',
  repostFailedTitle: '转播失败',
  postFailedTitle: '发布失败',
  retryMessage: '请重试。',

  // Reply errors
  cannotReplyTitle: '无法回复',
  replyMissingTarget: '缺少回复目标。',
  replyNeedsContent: '请输入文字或附上图片。',
  cannotRepostTitle: '无法转播',
  repostMissingTarget: '缺少转播目标。',

  // Bookmark
  bookmarkFailedTitle: '收藏失败',
  statusDeleteTitle: '删除动态',
  statusDeleteConfirm: '确认删除这条动态？',
  statusDeleteConfirmButton: '删除',
  statusDeleting: '删除中…',
  statusDeleteSuccess: '动态已删除。',
  statusDeleteFailedTitle: '删除失败',
  statusDeleteFailedMessage: '无法删除动态。',

  // Home screen
  homeTitle: '首页',
  homeEmpty: '这里还没有内容。',
  homeLoadFailed: '加载时间线失败。',

  // Mentions screen
  mentionsTitle: '提到我的',
  mentionsEmpty: '还没有提到我的内容。',
  mentionsLoadFailed: '加载提到我的失败。',

  // My timeline screen
  myTimelineTitle: '我的饭否',
  timelineTitle: '时间线',
  myTimelineEmpty: '还没有发布内容。',
  timelineLoadFailed: '加载时间线失败。',

  // Photos screen
  photosTitle: '照片',
  photosEmpty: '还没有照片。',
  photosLoadFailed: '加载照片失败。',

  // Favorites screen
  favoritesTitle: '收藏',
  favoritesEmpty: '还没有收藏的内容。',
  favoritesLoadFailed: '加载收藏失败。',

  // Status screen
  statusLoadFailed: '加载动态失败。',
  conversationLoadFailed: '加载对话失败。',
  statusMissingId: '缺少动态 ID。',
  conversationLoading: '加载对话中…',

  // Tag timeline screen
  tagTimelineTitle: '#{{tag}}#',
  tagTimelineFallbackTitle: '话题时间线',
  tagTimelineEmpty: '该话题还没有内容。',
  tagTimelineLoadFailed: '加载话题时间线失败。',
  tagMissing: '缺少话题。',

  // User list screen
  followingTitle: '我关注的人',
  followersTitle: '关注我的人',
  followingTitleOther: 'TA关注的人',
  followersTitleOther: '关注TA的人',
  followingEmpty: '还没有关注任何人。',
  followersEmpty: '还没有关注我的人。',
  followingEmptyOther: 'TA还没有关注任何人。',
  followersEmptyOther: '还没有人关注TA。',
  userListLoadFailed: '加载用户列表失败。',

  // Profile screen
  profileStatPosts: '消息',
  profileStatFollowing: '我关注的人',
  profileStatFollowers: '关注我的人',
  profileStatFollowingOther: 'TA关注的人',
  profileStatFollowersOther: '关注TA的人',
  profileStatFavorites: '收藏',
  profileStatPhotos: '照片',
  recentActivity: '最近动态',
  recentActivityEmpty: '还没有最近动态。',
  protectedAccountNotice: '该账号已设置为保护，关注后可查看最近动态。',
  profileLoadFailed: '加载用户资料失败。',
  profileActionMention: '提及',
  profileActionMessage: '私信',
  profileActionFollow: '关注',
  profileActionUnfollow: '取消关注',
  profileActionBlock: '屏蔽',
  profileActionUnblock: '取消屏蔽',
  profileActionChecking: '检查中…',
  profileActionUpdating: '更新中…',
  profileFollowSuccess: '已关注 @{{name}}。',
  profileUnfollowSuccess: '已取消关注 @{{name}}。',
  profileBlockSuccess: '已屏蔽 @{{name}}。',
  profileUnblockSuccess: '已取消屏蔽 @{{name}}。',
  profileFollowFailed: '无法更新关注状态。',
  profileBlockFailed: '无法更新屏蔽状态。',
  profileMentionComposerTitle: '提及 {{handle}}',
  profileMessageComposerTitle: '发私信给 {{handle}}',
  profileMessagePlaceholder: '写下你的私信…',
  profileMentionSent: '提及已发布。',
  profileMessageSent: '私信已发送。',
  profileSendFailed: '发送失败',
  profileSendFailedMessage: '无法发送消息。',
  profileNeedsContent: '请先输入文字。',
  cannotSendTitle: '无法发送',

  // Messages screen
  messagesTitle: '私信',
  messagesInbox: '收件箱',
  messagesOutbox: '发件箱',
  messagesInboxEmpty: '收件箱没有消息。',
  messagesOutboxEmpty: '发件箱没有消息。',
  messagesLoadFailed: '加载私信失败。',
  messageDeleteTitle: '删除消息',
  messageDeleteConfirm: '确认删除来自 {{name}} 的消息？',
  messageDeleteCancel: '取消',
  messageDeleteConfirmButton: '删除',
  messageDeleteFailed: '删除失败',
  messageDeleteFailedMessage: '无法删除消息。',
  messageReplyFailed: '回复失败',
  messageReplyFailedMessage: '发送回复失败。',
  messageReplyPlaceholder: '写下你的回复…',
  messageReplyComposerTitle: '回复 @{{name}}',
  messageSend: '发送',
  cannotSendMessageTitle: '无法发送',
  messageNeedsContent: '请输入消息内容。',

  // More screen
  morePrivateMessages: '私信',
  morePrivateMessagesHelper: '收件箱与发件箱',
  moreSignOut: '退出登录',
  moreSigningOut: '正在退出…',
  moreSignOutConfirmTitle: '退出登录',
  moreSignOutConfirmMessage: '确认退出登录？',
  moreFontStyle: '字体',
  moreFontSize: '字体大小',
  moreFontOptionSystem: '系统字体',
  moreFontSizeXS: '极小',
  moreFontSizeSM: '偏小',
  moreFontSizeMD: '标准',
  moreFontSizeLG: '偏大',
  moreFontSizeXL: '特大',
  moreLanguage: '语言',
  moreLanguageSystemDefault: '跟随系统',
  moreTheme: '主题',
  moreThemeColorful: '多彩',
  moreThemePlain: '纯色',
  moreFontUpdateFailed: '更新失败',
  moreFontUpdateFailedMessage: '无法更新字体设置。',
  moreStyle: '风格',
  moreStyleSoft: '柔和',
  moreStyleSharp: '干练',
  moreFollowProfile: '跟随用户颜色设置',
  moreFollowProfileHint: '如果觉得这个页面的颜色不好看，可以前往饭否官网设置自己的背景图和配色，或者关闭「跟随用户颜色设置」。',
  moreAccountLoading: '正在加载账号…',
  moreAccountLoadFailed: '无法加载账号信息。',
  moreAccountLoadFailedNoId: '无法加载账号信息，缺少用户 ID。',

  // Edit profile screen
  editProfileLoading: '正在加载个人资料…',
  editProfileLoadFailed: '无法加载个人资料。',
  editProfileRetry: '重试',
  editProfileName: '昵称',
  editProfileNamePlaceholder: '你的昵称',
  editProfileLocation: '所在地',
  editProfileLocationPlaceholder: '你在哪里？',
  editProfileWebsite: '个人网站',
  editProfileWebsitePlaceholder: 'https://example.com',
  editProfileBio: '简介',
  editProfileBioPlaceholder: '介绍一下你自己',
  editProfileSave: '保存',
  editProfileSaveFailedTitle: '无法保存',
  editProfileNameRequired: '昵称不能为空。',
  editProfileUpdateFailedTitle: '更新失败',
  editProfileUpdateFailed: '无法更新个人资料。',
  editProfilePendingReviewMessage:
    '资料已提交。由于内容审查，修改可能需要 10 分钟或更久才会显示。',

  // Photo viewer
  photoViewerClose: '关闭',
  photoViewerCloseA11y: '关闭图片查看器',

  // Common
  notLoggedIn: '未找到登录用户。',
  operationFailed: '操作失败',
  successTitle: '成功',
};

export type TranslationKey = keyof BaseTranslations;

export const RESOURCES: Record<LocaleKey, { translation: BaseTranslations }> = {
  'en-US': { translation: enUS },
  'zh-CN': { translation: zhCN },
};

export const DEFAULT_LOCALE: LocaleKey = 'en-US';

export const normalizeLocaleTag = (value: string) => value.replace('_', '-');
