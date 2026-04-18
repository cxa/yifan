// Fanfou's native OAuth module surfaces HTTP failures as
// `HTTP error <code>: <raw-body>`. The body is typically a JSON
// blob containing a human-readable `error` field (often in Chinese,
// with Unicode escapes that JSON.parse decodes for us). Extract and
// return just that field so we can show a clean reason to the user.
export const parseFanfouErrorReason = (message: string): string | null => {
  const match = message.match(/^HTTP error \d+:\s*(.+)$/s);
  if (!match) return null;
  const body = match[1].trim();
  if (!body.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string') {
      const trimmed = parsed.error.trim();
      if (trimmed) return trimmed;
    }
  } catch {
    return null;
  }
  return null;
};

export const toFanfouError = (err: unknown): Error => {
  if (!(err instanceof Error)) return new Error(String(err));
  const reason = parseFanfouErrorReason(err.message);
  if (!reason) return err;
  const decorated = new Error(reason);
  decorated.name = err.name;
  return decorated;
};
