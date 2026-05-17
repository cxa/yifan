import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import FaceDetection, { type Face } from '@react-native-ml-kit/face-detection';
import QRCode from 'react-native-qrcode-svg';
import type { FanfouStatus } from '@/types/fanfou';
import {
  CARD_BG_DARK,
  CARD_BG_LIGHT,
  type DropShadowBoxType,
} from '@/components/drop-shadow-box';
import { parseHtmlToText } from '@/utils/parse-html';
import { useAppFontFamily } from '@/settings/app-font-preference';
import { parseFanfouDate } from '@/utils/fanfou-date';
import { getIntlLocale } from '@/i18n/intl-locale';

export type ShareCardAspect = 'auto' | '1:1' | '3:4' | '9:16';
export type ShareCardTheme = 'light' | 'dark';
export type ShareCardCorners = 'rounded' | 'square';
export type ShareCardColor =
  | 'cream'
  | 'coral'
  | 'apricot'
  | 'lilac'
  | 'sky'
  | 'mint'
  | 'white'
  | 'black';

export const SHARE_CARD_ASPECTS: ReadonlyArray<{
  key: ShareCardAspect;
  // null ratio = intrinsic height; consumers should branch on key === 'auto'.
  ratio: number | null;
}> = [
  { key: 'auto', ratio: null },
  { key: '1:1', ratio: 1 },
  { key: '3:4', ratio: 4 / 3 },
  { key: '9:16', ratio: 16 / 9 },
];

const COLOR_TO_DROP_SHADOW: Record<
  Exclude<ShareCardColor, 'white' | 'black'>,
  DropShadowBoxType
> = {
  cream: 'default',
  coral: 'accent',
  apricot: 'warning',
  lilac: 'danger',
  sky: 'sky',
  mint: 'success',
};

export const SHARE_CARD_COLORS: ReadonlyArray<ShareCardColor> = [
  'cream',
  'coral',
  'apricot',
  'lilac',
  'sky',
  'mint',
  'white',
  'black',
];

const FOREGROUND_LIGHT = '#1A1208';
const FOREGROUND_DARK = '#F2EDE8';
const MUTED_LIGHT = '#7C7268';
const MUTED_DARK = '#9C9288';
const AVATAR_BG_LIGHT = '#0000001A';
const AVATAR_BG_DARK = '#00000033';
const PHOTO_BG_LIGHT = '#0000000F';
const PHOTO_BG_DARK = '#00000033';
const QR_FOREGROUND = '#111111';
const QR_BACKGROUND = '#FFFFFF';
const FOOTER_SEPARATOR_LIGHT = '#0000001A';
const FOOTER_SEPARATOR_DARK = '#FFFFFF24';
const IOS_DOWNLOAD_URL = 'https://apps.apple.com/app/id541110403';
const ANDROID_DOWNLOAD_URL = 'https://github.com/cxa/yifan/releases';
const YIFAN_LOGO_SOURCE = require(
  '../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
);

export const resolveShareCardBackground = (
  color: ShareCardColor,
  theme: ShareCardTheme,
): string => {
  if (color === 'white') return '#FFFFFF';
  if (color === 'black') return '#101010';
  const type = COLOR_TO_DROP_SHADOW[color];
  return theme === 'dark' ? CARD_BG_DARK[type] : CARD_BG_LIGHT[type];
};

const formatFullTimestamp = (value?: string): string => {
  if (!value) return '';
  const date = parseFanfouDate(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(getIntlLocale(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    // Fallback to ISO if Intl is unavailable on the runtime.
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
};

const EMOJI_RE = /([\uD83C-\uD83F][\uDC00-\uDFFF]|[☀-➿]|❤[️]?)/g;
const EMOJI_FONT = Platform.OS === 'android' ? 'sans-serif' : 'Helvetica Neue';

const renderTextWithEmoji = (
  text: string,
  fontFamily: string | undefined,
): React.ReactNode => {
  const parts = text.split(EMOJI_RE);
  if (parts.length === 1) {
    return fontFamily ? (
      <RNText style={{ fontFamily }}>{text}</RNText>
    ) : (
      text
    );
  }
  return parts.map((part, i) => {
    if (!part) return null;
    if (i % 2 === 1) {
      const emojiStyle = { fontFamily: EMOJI_FONT };
      return (
        <RNText key={i} style={emojiStyle}>
          {part}
        </RNText>
      );
    }
    return fontFamily ? (
      <RNText key={i} style={{ fontFamily }}>
        {part}
      </RNText>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });
};

type ShareStatusCardProps = {
  status: FanfouStatus;
  aspect: ShareCardAspect;
  theme: ShareCardTheme;
  color: ShareCardColor;
  corners: ShareCardCorners;
  width: number;
};

const ShareStatusCard = React.forwardRef<View, ShareStatusCardProps>(
  ({ status, aspect, theme, color, corners, width }, ref) => {
    const fontFamily = useAppFontFamily() ?? undefined;
    const aspectEntry =
      SHARE_CARD_ASPECTS.find(a => a.key === aspect) ?? SHARE_CARD_ASPECTS[0];
    // Auto mode keeps height intrinsic so the card grows with content; the
    // others snap to a target aspect for capture-friendly social ratios.
    const height =
      aspectEntry.ratio === null ? undefined : width * aspectEntry.ratio;
    const isAuto = aspect === 'auto';
    const bg = resolveShareCardBackground(color, theme);
    const isDark = theme === 'dark';
    const fg = isDark ? FOREGROUND_DARK : FOREGROUND_LIGHT;
    const muted = isDark ? MUTED_DARK : MUTED_LIGHT;
    const avatarBg = isDark ? AVATAR_BG_DARK : AVATAR_BG_LIGHT;
    const photoBg = isDark ? PHOTO_BG_DARK : PHOTO_BG_LIGHT;
    const footerSeparator = isDark
      ? FOOTER_SEPARATOR_DARK
      : FOOTER_SEPARATOR_LIGHT;
    const bodyText = parseHtmlToText(status.text || status.status);
    const photoUrl =
      status.photo?.largeurl ||
      status.photo?.imageurl ||
      status.photo?.thumburl;
    const timestamp = formatFullTimestamp(status.created_at);
    const user = status.user;
    const displayName = user.screen_name || user.name || user.id;
    const handle = `@${user.id}`;

    // Linear scale based on a 360pt design baseline so the card renders
    // crisply at whatever width the host hands us (preview or capture).
    const s = width / 360;
    const pad = 28 * s;
    const isSquare = corners === 'square';
    const radius = isSquare ? 0 : 28 * s;
    const avatarSize = 52 * s;
    const nameSize = 18 * s;
    const handleSize = 13 * s;
    const bodySize =
      (aspect === '9:16' ? 22 : aspect === '3:4' ? 20 : 18) * s;
    const isCompactFooter = aspect === '1:1';
    const bodyLineHeight = bodySize * 1.55;
    const headerGap = 12 * s;
    const handleMarginTop = 2 * s;
    const bodyMarginTop = 22 * s;
    const bodyGap = 18 * s;
    const photoRadius = isSquare ? 0 : 18 * s;
    const timestampSize = 12 * s;
    const timestampMarginTop = 18 * s;
    const timestampLineHeight = Math.round(timestampSize * 1.4);
    const qrSize = Math.max(
      isCompactFooter ? 22 : 24,
      (isCompactFooter ? 24 : 30) * s,
    );
    const qrQuietZone = Math.max(1, 2 * s);
    const qrGap = (isCompactFooter ? 5 : 6) * s;
    const qrLabelSize = Math.max(6, (isCompactFooter ? 6 : 7) * s);
    const qrLabelLineHeight = Math.ceil(qrLabelSize * 1.1);
    const qrLabelMarginTop = (isCompactFooter ? 1.5 : 2) * s;
    const qrBlockWidth = qrSize * 2 + qrGap;
    const qrBlockHeight = qrSize + qrLabelMarginTop + qrLabelLineHeight;
    const logoSize = qrSize;
    const logoRadius = (isCompactFooter ? 7 : 8) * s;
    const footerGap = (isCompactFooter ? 8 : 12) * s;
    const footerSeparatorHeight = StyleSheet.hairlineWidth;
    const footerSeparatorBottom = pad + qrBlockHeight + footerGap;
    const timestampFlowHeight = timestamp
      ? timestampMarginTop + timestampLineHeight
      : 0;
    // The timestamp belongs to the content flow; only the logo/QR row reserves
    // the bottom-right card area.
    const bottomSlot = qrBlockHeight + footerGap * 2 + footerSeparatorHeight;

    // In auto mode the card grows to fit the photo, so use the photo's real
    // aspect ratio (clamped to a sane range) — that keeps the image visible
    // in full with no cropping. Fixed-aspect modes ignore this because the
    // photo gets a flex:1 box whose shape is whatever the card has left.
    const [intrinsic, setIntrinsic] =
      useState<{ w: number; h: number } | null>(null);
    const photoAspect = intrinsic ? intrinsic.w / intrinsic.h : null;
    const autoPhotoAspectRatio = photoAspect
      ? Math.min(Math.max(photoAspect, 0.4), 2.4)
      : 4 / 3;

    // Face-aware crop for fixed aspects: detect faces once the photo URL is
    // known, then shift the cover-scaled image so the union of all face
    // bounding boxes stays inside the container. Auto mode renders the
    // whole image at its natural aspect, so faces are always visible there.
    const [faces, setFaces] = useState<Face[] | null>(null);
    useEffect(() => {
      if (!photoUrl) {
        setFaces(null);
        return;
      }
      let cancelled = false;
      // Accurate + small minFaceSize catches partially-visible faces and
      // smaller subjects that the fast/0.1 default misses. Cost is a few
      // hundred ms more on first load, which is fine for a share preview.
      FaceDetection.detect(photoUrl, {
        performanceMode: 'accurate',
        minFaceSize: 0.05,
      })
        .then(detected => {
          if (!cancelled) setFaces(detected);
        })
        .catch(() => {
          if (!cancelled) setFaces([]);
        });
      return () => {
        cancelled = true;
      };
    }, [photoUrl]);

    // Measure the header and text so we can explicitly compute the photo's
    // maxHeight. Flex:1 + paddingBottom on iOS doesn't reliably clamp a
    // photo container whose underlying Image has a large intrinsic content
    // size — without this explicit cap the photo overflows downward into
    // the timestamp and bottom QR slot.
    const [headerHeight, setHeaderHeight] = useState(0);
    const [textHeight, setTextHeight] = useState(0);
    const photoMaxHeight =
      !isAuto && typeof height === 'number'
        ? Math.max(
            0,
            height -
              pad * 2 -
              bottomSlot -
              headerHeight -
              timestampFlowHeight -
              (bodyText ? bodyMarginTop + textHeight + bodyGap : bodyMarginTop),
          )
        : undefined;

    // Smart crop math: derive the image's display rect inside the cover
    // container, then shift it so the focal point sits near the container
    // center (clamped so we never expose container bg).
    //
    // Focal point sourcing, in order:
    //   1. Union center of detected faces.
    //   2. Fallback heuristic — when the source is meaningfully more
    //      portrait than the container, bias toward the upper third.
    //      That's where subjects typically sit in portrait photos, and
    //      it salvages cases where face detection comes up empty
    //      (no face, occluded face, or a body-only crop).
    //   3. Plain center (yoga default).
    const photoContainerW = width - pad * 2;
    const photoContainerH = isAuto
      ? photoContainerW / autoPhotoAspectRatio
      : photoMaxHeight ?? 0;
    let smartImageStyle: {
      position: 'absolute';
      left: number;
      top: number;
      width: number;
      height: number;
    } | null = null;
    if (!isAuto && intrinsic && photoContainerH > 0 && faces !== null) {
      let focalX = intrinsic.w / 2;
      let focalY = intrinsic.h / 2;
      let usedFocal = false;
      if (faces.length > 0) {
        const minX = Math.min(...faces.map(f => f.frame.left));
        const minY = Math.min(...faces.map(f => f.frame.top));
        const maxX = Math.max(...faces.map(f => f.frame.left + f.frame.width));
        const maxY = Math.max(
          ...faces.map(f => f.frame.top + f.frame.height),
        );
        focalX = (minX + maxX) / 2;
        focalY = (minY + maxY) / 2;
        usedFocal = true;
      } else {
        const imageAspect = intrinsic.w / intrinsic.h;
        const containerAspect = photoContainerW / photoContainerH;
        if (imageAspect < containerAspect * 0.75) {
          // Image is noticeably more portrait than the container —
          // bias toward the upper third to surface likely subjects.
          focalY = intrinsic.h * 0.33;
          usedFocal = true;
        }
      }
      if (usedFocal) {
        const scale = Math.max(
          photoContainerW / intrinsic.w,
          photoContainerH / intrinsic.h,
        );
        const displayW = intrinsic.w * scale;
        const displayH = intrinsic.h * scale;
        const targetLeft = photoContainerW / 2 - focalX * scale;
        const targetTop = photoContainerH / 2 - focalY * scale;
        const imageLeft = Math.min(
          0,
          Math.max(photoContainerW - displayW, targetLeft),
        );
        const imageTop = Math.min(
          0,
          Math.max(photoContainerH - displayH, targetTop),
        );
        smartImageStyle = {
          position: 'absolute',
          left: imageLeft,
          top: imageTop,
          width: displayW,
          height: displayH,
        };
      }
    }

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.card,
          // Only center the content stack when there's no photo. With a
          // photo, flex:1 on the photo already consumes leftover space, and
          // `justifyContent: 'center'` would otherwise overflow content
          // *symmetrically* (clipping the avatar at top and timestamp at
          // bottom) the moment intrinsic content exceeded the card height.
          !isAuto && !photoUrl ? styles.cardCentered : null,
          {
            width,
            height,
            backgroundColor: bg,
            borderRadius: radius,
            padding: pad,
            // Reserve the bottom slot via paddingBottom so the timestamp,
            // which follows the content, and the QR pair cannot collide
            // with a greedy flex:1 photo with a tall intrinsic image.
            paddingBottom: pad + bottomSlot,
          },
        ]}
      >
        <View
          style={[styles.header, { gap: headerGap }]}
          onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          <Image
            source={{ uri: user.profile_image_url }}
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: avatarBg,
            }}
          />
          <View style={styles.headerText}>
            <RNText
              numberOfLines={1}
              style={[
                styles.name,
                { color: fg, fontSize: nameSize },
                fontFamily ? { fontFamily } : null,
              ]}
            >
              {displayName}
            </RNText>
            <RNText
              numberOfLines={1}
              style={[
                styles.handle,
                {
                  color: muted,
                  fontSize: handleSize,
                  marginTop: handleMarginTop,
                },
                fontFamily ? { fontFamily } : null,
              ]}
            >
              {handle}
            </RNText>
          </View>
        </View>

        {bodyText ? (
          <RNText
            onLayout={event => setTextHeight(event.nativeEvent.layout.height)}
            style={[
              styles.bodyText,
              {
                color: fg,
                fontSize: bodySize,
                lineHeight: bodyLineHeight,
                marginTop: bodyMarginTop,
              },
            ]}
          >
            {renderTextWithEmoji(bodyText, fontFamily)}
          </RNText>
        ) : null}
        {photoUrl ? (
          <View
            style={[
              styles.photo,
              isAuto
                ? { aspectRatio: autoPhotoAspectRatio }
                : { height: photoMaxHeight },
              {
                backgroundColor: photoBg,
                borderRadius: photoRadius,
                marginTop: bodyText ? bodyGap : bodyMarginTop,
              },
            ]}
          >
            <Image
              source={{ uri: photoUrl }}
              style={smartImageStyle ?? StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoad={event => {
                const { width: w, height: h } = event.nativeEvent.source;
                if (w > 0 && h > 0) {
                  setIntrinsic({ w, h });
                }
              }}
            />
          </View>
        ) : null}

        {timestamp ? (
          <RNText
            numberOfLines={1}
            style={[
              styles.timestamp,
              {
                color: muted,
                fontSize: timestampSize,
                lineHeight: timestampLineHeight,
                marginTop: timestampMarginTop,
                marginRight: qrBlockWidth + qrGap,
              },
              fontFamily ? { fontFamily } : null,
            ]}
          >
            {timestamp}
          </RNText>
        ) : null}

        <View
          style={[
            styles.footerSeparator,
            {
              left: pad,
              right: pad,
              bottom: footerSeparatorBottom,
              height: footerSeparatorHeight,
              backgroundColor: footerSeparator,
            },
          ]}
        />

        <View
          style={[
            styles.downloadRow,
            {
              left: pad,
              right: pad,
              bottom: pad,
              height: qrBlockHeight,
            },
          ]}
        >
          <Image
            source={YIFAN_LOGO_SOURCE}
            style={[
              styles.downloadLogo,
              {
                width: logoSize,
                height: logoSize,
                borderRadius: logoRadius,
              },
            ]}
          />

          <View
            style={[
              styles.downloadQrGroup,
              {
                gap: qrGap,
              },
            ]}
          >
            <DownloadQr
              label="iOS"
              value={IOS_DOWNLOAD_URL}
              size={qrSize}
              quietZone={qrQuietZone}
              labelSize={qrLabelSize}
              labelLineHeight={qrLabelLineHeight}
              labelMarginTop={qrLabelMarginTop}
              labelColor={muted}
            />
            <DownloadQr
              label="Android"
              value={ANDROID_DOWNLOAD_URL}
              size={qrSize}
              quietZone={qrQuietZone}
              labelSize={qrLabelSize}
              labelLineHeight={qrLabelLineHeight}
              labelMarginTop={qrLabelMarginTop}
              labelColor={muted}
            />
          </View>
        </View>
      </View>
    );
  },
);

ShareStatusCard.displayName = 'ShareStatusCard';

type DownloadQrProps = {
  label: string;
  value: string;
  size: number;
  quietZone: number;
  labelSize: number;
  labelLineHeight: number;
  labelMarginTop: number;
  labelColor: string;
};

const DownloadQr = ({
  label,
  value,
  size,
  quietZone,
  labelSize,
  labelLineHeight,
  labelMarginTop,
  labelColor,
}: DownloadQrProps) => (
  <View
    style={[
      styles.downloadQrItem,
      { minHeight: size + labelMarginTop + labelLineHeight },
    ]}
  >
    <QRCode
      value={value}
      size={size}
      quietZone={quietZone}
      color={QR_FOREGROUND}
      backgroundColor={QR_BACKGROUND}
      ecl="M"
    />
    <RNText
      numberOfLines={1}
      style={[
        styles.downloadQrLabel,
        {
          color: labelColor,
          fontSize: labelSize,
          lineHeight: labelLineHeight,
          marginTop: labelMarginTop,
        },
      ]}
    >
      {label}
    </RNText>
  </View>
);

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  // Fixed-aspect cards center the entire content stack (header + body +
  // timestamp) so a short status floats in the middle of the card rather
  // than hugging the top with empty space below.
  cardCentered: {
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '800',
  },
  handle: {
    fontWeight: '400',
  },
  bodyText: {
    fontWeight: '500',
  },
  photo: {
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  timestamp: {
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'left',
  },
  footerSeparator: {
    position: 'absolute',
  },
  downloadRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  downloadQrGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  downloadLogo: {
    flexShrink: 0,
  },
  downloadQrItem: {
    alignItems: 'center',
    flexShrink: 0,
  },
  downloadQrLabel: {
    fontWeight: '700',
  },
});

export default ShareStatusCard;
