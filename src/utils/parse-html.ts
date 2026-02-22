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
  | { type: 'mention'; text: string; screenName: string; url?: string };

const normalizeHtmlText = (value: unknown) => {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  const withLineBreaks = value.replace(/<\s*br\s*\/?>/gi, '\n');
  const withoutTags = withLineBreaks.replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(withoutTags);
};

const extractScreenNameFromUrl = (url: string) => {
  if (!url) {
    return null;
  }
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(normalized);
    if (!parsed.hostname.includes('fanfou.com')) {
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
  } catch {
    return null;
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
      segments.push({ type: 'text', text: beforeText });
    }

    const linkText = normalizeHtmlText(inner).trim();
    const sanitizedText = linkText.replace(/^@+/, '@');
    const screenNameFromText = sanitizedText.startsWith('@')
      ? sanitizedText.slice(1)
      : null;
    const screenNameFromUrl = extractScreenNameFromUrl(href);
    const screenName = screenNameFromUrl || screenNameFromText;
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
        url: href,
      });
    } else if (linkText) {
      segments.push({ type: 'text', text: linkText });
    }

    lastIndex = start + full.length;
  }

  const tail = value.slice(lastIndex);
  const tailText = normalizeHtmlText(tail);
  if (tailText) {
    segments.push({ type: 'text', text: tailText });
  }

  return segments;
};

export const parseHtmlToText = (value: unknown) => {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return normalizeHtmlText(value).trim();
};
