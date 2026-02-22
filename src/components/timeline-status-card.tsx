import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Heart, MessageCircle, Repeat2 } from 'lucide-react-native';

import type { FanfouStatus } from '@/types/fanfou';
import { Text } from '@/components/app-text';
import DropShadowBox from '@/components/drop-shadow-box';
import { formatTimestamp } from '@/utils/format-timestamp';
import { parseHtmlToSegments, parseHtmlToText } from '@/utils/parse-html';
import { openLink } from '@/utils/open-link';

type TimelineStatusCardProps = {
  status: FanfouStatus;
  accent: string;
  muted: string;
  isBookmarkPending: boolean;
  photoViewerVisible: boolean;
  photoViewerPreviewKey: string | null;
  activeTag?: string;
  registerPhotoPreviewRef: (
    key: string,
    node: React.ComponentRef<typeof View> | null,
  ) => void;
  onOpenPhoto: (photoUrl: string, previewKey: string) => void;
  onPressStatus: (statusId: string) => void;
  onPressProfile: (userId: string) => void;
  onPressMention: (userId: string) => void;
  onPressTag: (tag: string) => void;
  onReply: (status: FanfouStatus) => void;
  onRepost: (status: FanfouStatus) => void;
  onToggleBookmark: (status: FanfouStatus) => void;
};

const TAG_PILL_CLASS = 'bg-accent/15 text-accent px-2 py-0.5 rounded-full';
const ACTIVE_TAG_PILL_CLASS =
  'bg-accent text-accent-foreground px-2 py-0.5 rounded-full';

const getStatusId = (status: FanfouStatus): string => status.id;

const getStatusPhotoUrl = (status: FanfouStatus): string | null => {
  const getUrl = (...candidates: Array<string | undefined>) => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
    return null;
  };
  return getUrl(
    status.photo?.largeurl,
    status.photo?.imageurl,
    status.photo?.thumburl,
  );
};

const TimelineStatusCard = ({
  status,
  accent,
  muted,
  isBookmarkPending,
  photoViewerVisible,
  photoViewerPreviewKey,
  activeTag,
  registerPhotoPreviewRef,
  onOpenPhoto,
  onPressStatus,
  onPressProfile,
  onPressMention,
  onPressTag,
  onReply,
  onRepost,
  onToggleBookmark,
}: TimelineStatusCardProps) => {
  const statusId = getStatusId(status);
  const user = status.user;
  const displayName = user.screen_name || user.name;
  const screenName = user.screen_name;
  const userId = user.id;
  const handle = `@${userId}`;
  const avatarUrl = user.profile_image_url;
  const photoUrl = getStatusPhotoUrl(status);
  const photoPreviewKey = `${statusId}-photo`;
  const segments = parseHtmlToSegments(status.text || status.status);
  const timestamp = formatTimestamp(status.created_at);
  const sourceClient = parseHtmlToText(status.source).trim();
  const viaLabel = sourceClient ? `via ${sourceClient}` : '';
  const normalizedActiveTag = activeTag?.toLowerCase();

  return (
    <DropShadowBox>
      <Pressable
        onPress={() => onPressStatus(statusId)}
        className="bg-surface border-2 border-foreground dark:border-border px-5 py-4 active:translate-x-[-4px] active:translate-y-[4px]"
      >
        <View className="flex-row gap-3">
          <Pressable
            onPress={event => {
              event.stopPropagation();
              onPressProfile(userId);
            }}
            className="h-10 w-10"
            accessibilityRole="button"
            accessibilityLabel={`Open profile ${screenName || userId}`}
          >
            <Image
              source={{ uri: avatarUrl }}
              className="h-10 w-10 rounded-full bg-surface-secondary"
            />
          </Pressable>

          <View className="flex-1">
            <Text
              className="text-[17px] font-bold text-foreground"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <Text
                className="min-w-0 flex-1 text-[14px] text-muted"
                numberOfLines={1}
              >
                {handle}
              </Text>
              <Text
                className="shrink-0 text-[12px] text-muted"
                numberOfLines={1}
              >
                {timestamp}
              </Text>
            </View>
            <Text className="mt-1 text-[15px] leading-6 text-foreground">
              {segments.length > 0
                ? segments.map((segment, segmentIndex) => {
                    if (segment.type === 'mention') {
                      return (
                        <Text
                          key={`${statusId}-${segmentIndex}`}
                          className="text-accent"
                          onPress={event => {
                            event.stopPropagation();
                            onPressMention(segment.screenName);
                          }}
                        >
                          {segment.text}
                        </Text>
                      );
                    }
                    if (segment.type === 'tag') {
                      const isActiveTag =
                        Boolean(normalizedActiveTag) &&
                        normalizedActiveTag === segment.tag.toLowerCase();
                      return (
                        <Text
                          key={`${statusId}-${segmentIndex}`}
                          className={
                            isActiveTag ? ACTIVE_TAG_PILL_CLASS : TAG_PILL_CLASS
                          }
                          onPress={event => {
                            event.stopPropagation();
                            onPressTag(segment.tag);
                          }}
                        >
                          {segment.text}
                        </Text>
                      );
                    }
                    if (segment.type === 'link') {
                      return (
                        <Text
                          key={`${statusId}-${segmentIndex}`}
                          className="text-accent underline"
                          onPress={event => {
                            event.stopPropagation();
                            openLink(segment.href);
                          }}
                        >
                          {segment.text}
                        </Text>
                      );
                    }
                    return segment.text;
                  })
                : ''}
            </Text>
            {photoUrl ? (
              <View
                className={
                  photoViewerVisible &&
                  photoViewerPreviewKey === photoPreviewKey
                    ? 'opacity-0'
                    : undefined
                }
              >
                <Pressable
                  onPress={() => onOpenPhoto(photoUrl, photoPreviewKey)}
                  className="mt-3 overflow-hidden border border-border bg-surface-secondary"
                  accessibilityRole="button"
                  accessibilityLabel="Open photo"
                >
                  <View
                    ref={node => registerPhotoPreviewRef(photoPreviewKey, node)}
                    collapsable={false}
                    className="h-[220px] w-full"
                  >
                    <Image
                      source={{ uri: photoUrl }}
                      className="h-full w-full bg-surface-secondary"
                      resizeMode="cover"
                    />
                  </View>
                </Pressable>
              </View>
            ) : null}
            <View className="mt-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-4">
                <Pressable
                  onPress={() => onReply(status)}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Reply"
                >
                  <MessageCircle size={16} color={muted} />
                </Pressable>
                <Pressable
                  onPress={() => onRepost(status)}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Repost"
                >
                  <Repeat2 size={16} color={muted} />
                </Pressable>
                <Pressable
                  onPress={() => onToggleBookmark(status)}
                  disabled={isBookmarkPending}
                  className={`p-1 ${isBookmarkPending ? 'opacity-50' : ''}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    status.favorited ? 'Remove bookmark' : 'Bookmark'
                  }
                >
                  <Heart size={16} color={status.favorited ? accent : muted} />
                </Pressable>
              </View>
              {viaLabel ? (
                <Text
                  className="ml-3 flex-1 text-right text-[12px] text-muted"
                  numberOfLines={1}
                >
                  {viaLabel}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </DropShadowBox>
  );
};

export default TimelineStatusCard;
