import * as Keychain from 'react-native-keychain';
import type { OAuthAccessToken } from 'rn-fanfou-client';

export type AuthAccessToken = OAuthAccessToken & {
  oauthToken: string;
  oauthTokenSecret: string;
  userId: string;
  screenName: string;
};

const SERVICE = 'fanfou.oauth';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const parseAccessToken = (raw?: string | null): AuthAccessToken | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    const oauthToken = getString(parsed.oauthToken);
    const oauthTokenSecret = getString(parsed.oauthTokenSecret);
    const userId = getString(parsed.userId);
    const screenName = getString(parsed.screenName);
    if (!oauthToken || !oauthTokenSecret || !userId || !screenName) {
      return null;
    }
    return { oauthToken, oauthTokenSecret, userId, screenName };
  } catch {
    return null;
  }
};

export const loadAuthAccessToken =
  async (): Promise<AuthAccessToken | null> => {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (!creds) {
      return null;
    }
    return parseAccessToken(creds.password);
  };

export const saveAuthAccessToken = async (
  accessToken: AuthAccessToken | null,
): Promise<void> => {
  if (!accessToken) {
    await Keychain.resetGenericPassword({ service: SERVICE });
    return;
  }
  await Keychain.setGenericPassword('fanfou', JSON.stringify(accessToken), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
};
