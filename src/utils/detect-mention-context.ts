export type MentionContext = {
  partial: string;
  start: number;
  end: number;
};

const WORD_CHAR_RE = /[A-Za-z0-9_]/;
const WHITESPACE_RE = /\s/;

// Walk backwards from the cursor for the nearest '@'. The '@' counts as
// a mention trigger only if it sits at the start of the text or is NOT
// immediately preceded by a word character — otherwise "email@foo" would
// open the suggestion popover mid-token. Whitespace between '@' and the
// cursor closes the context.
export const detectMentionContext = (
  text: string,
  cursorPos: number,
): MentionContext | null => {
  if (cursorPos < 1) {
    return null;
  }
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '@') {
      if (i === 0 || !WORD_CHAR_RE.test(text[i - 1])) {
        return {
          partial: text.slice(i + 1, cursorPos),
          start: i,
          end: cursorPos,
        };
      }
      return null;
    }
    if (WHITESPACE_RE.test(ch)) {
      return null;
    }
  }
  return null;
};
