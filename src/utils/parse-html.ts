const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeHtmlEntity = (entity: string) => {
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const codePoint = Number.parseInt(entity.slice(2), 16);
    return Number.isNaN(codePoint) ? null : String.fromCodePoint(codePoint);
  }
  if (entity.startsWith('#')) {
    const codePoint = Number.parseInt(entity.slice(1), 10);
    return Number.isNaN(codePoint) ? null : String.fromCodePoint(codePoint);
  }
  return NAMED_ENTITIES[entity] ?? null;
};

const decodeHtmlEntities = (value: string) =>
  value.replace(/&([#xX0-9a-zA-Z]+);/g, (match, entity) => {
    const decoded = decodeHtmlEntity(entity);
    return decoded ?? match;
  });

export type HtmlTextSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; screenName: string; url?: string }
  | { type: 'tag'; text: string; tag: string; url?: string }
  | { type: 'link'; text: string; href: string };

const URL_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

const normalizeHtmlText = (value: unknown) => {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  const withLineBreaks = value.replace(/<\s*br\s*\/?>/gi, '\n');
  const withoutTags = withLineBreaks.replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(withoutTags);
};

const parseFanfouUrl = (url: string): URL | null => {
  if (!url) {
    return null;
  }
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url);
    }
    if (url.startsWith('/')) {
      return new URL(url, 'https://fanfou.com');
    }
    return new URL(`https://${url}`);
  } catch {
    return null;
  }
};

const normalizeHrefForOpen = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('/')) {
    return `https://fanfou.com${trimmed}`;
  }
  if (URL_SCHEME_REGEX.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const normalizeTag = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().replace(/^#+/, '').replace(/#+$/, '').trim();
  return normalized || null;
};

const extractTagFromText = (text: string) => {
  const match = text.match(/^#([^#\r\n]+)#$/);
  if (!match) {
    return null;
  }
  return normalizeTag(match[1]);
};

const formatTagText = (tag: string, rawText?: string) => {
  const normalizedText = normalizeTag(rawText);
  if (normalizedText && normalizedText.toLowerCase() === tag.toLowerCase()) {
    return `#${normalizedText}#`;
  }
  return `#${tag}#`;
};

const pushTextWithTags = (segments: HtmlTextSegment[], value: string) => {
  if (!value) {
    return;
  }
  // Only parse standalone #tag# tokens; skip wrapped forms like ##tag##.
  const tagRegex = /(^|[^#])#([^#\r\n]+)#(?=[^#]|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(value)) !== null) {
    const [, prefix, rawTag] = match;
    const start = match.index + prefix.length;
    const before = value.slice(lastIndex, start);
    if (before) {
      segments.push({ type: 'text', text: before });
    }

    const tag = normalizeTag(rawTag);
    if (tag) {
      segments.push({
        type: 'tag',
        text: formatTagText(tag, `#${rawTag}#`),
        tag,
      });
    } else {
      segments.push({ type: 'text', text: `#${rawTag}#` });
    }

    lastIndex = start + rawTag.length + 2;
  }

  const tail = value.slice(lastIndex);
  if (tail) {
    segments.push({ type: 'text', text: tail });
  }
};

const extractScreenNameFromUrl = (url: string) => {
  const parsed = parseFanfouUrl(url);
  if (!parsed || !parsed.hostname.includes('fanfou.com')) {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) {
    return null;
  }
  const [segment] = segments;
  if (!segment || segment.toLowerCase() === 'statuses') {
    return null;
  }
  return segment;
};

const extractTagFromUrl = (url: string) => {
  const parsed = parseFanfouUrl(url);
  if (!parsed || !parsed.hostname.includes('fanfou.com')) {
    return null;
  }
  const queryTag = normalizeTag(parsed.searchParams.get('q'));
  if (queryTag) {
    return queryTag;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  if (segments[0].toLowerCase() !== 'q') {
    return null;
  }
  try {
    return normalizeTag(decodeURIComponent(segments[1]));
  } catch {
    return normalizeTag(segments[1]);
  }
};

export const parseHtmlToSegments = (value: unknown): HtmlTextSegment[] => {
  if (typeof value !== 'string' || !value) {
    return [];
  }
  const segments: HtmlTextSegment[] = [];
  const linkRegex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(value)) !== null) {
    const [full, , href, inner] = match;
    const start = match.index;
    const before = value.slice(lastIndex, start);
    const beforeText = normalizeHtmlText(before);
    if (beforeText) {
      pushTextWithTags(segments, beforeText);
    }

    const linkText = normalizeHtmlText(inner).trim();
    const normalizedHref = normalizeHrefForOpen(href);
    const sanitizedText = linkText.replace(/^@+/, '@');
    const screenNameFromText = sanitizedText.startsWith('@')
      ? sanitizedText.slice(1)
      : null;
    const screenNameFromUrl = extractScreenNameFromUrl(href);
    const screenName = screenNameFromUrl || screenNameFromText;
    const tagFromUrl = extractTagFromUrl(href);
    const tagFromText = extractTagFromText(linkText);
    const tag = normalizeTag(tagFromUrl || tagFromText);
    let nextLastIndex = start + full.length;
    if (screenName) {
      const lastSegment = segments[segments.length - 1];
      if (lastSegment?.type === 'text') {
        const trimmed = lastSegment.text.replace(/\s+$/, '');
        if (trimmed.endsWith('@')) {
          const withoutAt = trimmed.slice(0, -1);
          const trailing = lastSegment.text.slice(trimmed.length);
          lastSegment.text = `${withoutAt}${trailing}`;
          if (!lastSegment.text) {
            segments.pop();
          }
        }
      }
      const mentionText = sanitizedText.startsWith('@')
        ? sanitizedText
        : `@${screenName}`;
      segments.push({
        type: 'mention',
        text: mentionText,
        screenName,
        url: normalizedHref ?? href,
      });
    } else if (tag) {
      const linkTextHasHash = linkText.includes('#');
      let tagText = formatTagText(tag, linkText);
      if (!linkTextHasHash) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment?.type === 'text' && lastSegment.text.endsWith('#')) {
          lastSegment.text = lastSegment.text.slice(0, -1);
          if (!lastSegment.text) {
            segments.pop();
          }
        }
        if (value[nextLastIndex] === '#') {
          nextLastIndex += 1;
        }
        tagText = `#${tag}#`;
      }
      segments.push({
        type: 'tag',
        text: tagText,
        tag,
        url: normalizedHref ?? href,
      });
    } else if (linkText || normalizedHref) {
      segments.push({
        type: 'link',
        text: linkText || normalizedHref || href,
        href: normalizedHref ?? href,
      });
    }

    lastIndex = nextLastIndex;
  }

  const tail = value.slice(lastIndex);
  const tailText = normalizeHtmlText(tail);
  if (tailText) {
    pushTextWithTags(segments, tailText);
  }

  return segments;
};

export const parseHtmlToText = (value: unknown) => {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return normalizeHtmlText(value).trim();
};
