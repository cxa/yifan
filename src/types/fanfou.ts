export type FanfouPhoto = {
  imageurl: string;
  thumburl: string;
  largeurl: string;
};

export type FanfouUser = {
  id: string;
  name: string;
  screen_name: string;
  unique_id: string;
  location: string;
  gender: string;
  birthday: string;
  description: string;
  profile_image_url: string;
  profile_image_url_large: string;
  url: string;
  protected: boolean;
  followers_count: number;
  friends_count: number;
  favourites_count: number;
  statuses_count: number;
  photo_count: number;
  following: boolean;
  notifications: boolean;
  created_at: string;
  utc_offset: number;
  profile_background_color: string;
  profile_text_color: string;
  profile_link_color: string;
  profile_sidebar_fill_color: string;
  profile_sidebar_border_color: string;
  profile_background_image_url: string;
  profile_background_tile: boolean;
};

export type FanfouStatus = {
  created_at: string;
  id: string;
  rawid: number;
  text: string;
  status: string;
  source: string;
  truncated: boolean;
  in_reply_to_status_id?: string;
  in_reply_to_user_id?: string;
  in_reply_to_screen_name?: string;
  repost_status_id?: string;
  repost_status?: string;
  repost_user_id?: string;
  repost_screen_name?: string;
  favorited: boolean;
  user: FanfouUser;
  photo?: FanfouPhoto;
};
