import {
  FanfouClient,
  getAccessToken,
  type OAuthAccessToken,
} from 'rn-fanfou-client';

import type { AuthAccessToken } from './secure-token-storage';
import type { FanfouUser } from '@/types/fanfou';
import { toFanfouError } from '@/utils/parse-fanfou-error';

let fanfouClient: FanfouClient | null = null;
let cachedAccessToken: AuthAccessToken | null = null;

export const setFanfouAccessToken = (accessToken: AuthAccessToken | null) => {
  cachedAccessToken = accessToken;
  if (!accessToken) {
    fanfouClient = null;
    return;
  }
  fanfouClient = new FanfouClient(accessToken);
};

export const getFanfouClient = (): FanfouClient => {
  if (fanfouClient) {
    return fanfouClient;
  }
  if (!cachedAccessToken) {
    throw new Error('Missing OAuth access token. Authenticate first.');
  }
  fanfouClient = new FanfouClient(cachedAccessToken);
  return fanfouClient;
};

type FanfouGetParams = Record<string, string | number | boolean | undefined>;
type FanfouPostParams = Record<string, string | number | boolean | undefined>;

export const get = async (
  endpoint: string,
  params?: FanfouGetParams,
): Promise<unknown> => {
  const client = getFanfouClient();
  try {
    return await client.get(endpoint, {
      ...params,
      format: 'html',
    });
  } catch (err) {
    throw toFanfouError(err);
  }
};

export const post = async (
  endpoint: string,
  params?: FanfouPostParams,
): Promise<unknown> => {
  const client = getFanfouClient();
  try {
    return await client.post(endpoint, {
      ...params,
      format: 'html',
    });
  } catch (err) {
    throw toFanfouError(err);
  }
};

export const uploadPhoto = async ({
  photoBase64,
  status,
  mimeType,
  fileName,
  params,
}: {
  photoBase64: string;
  status?: string;
  mimeType?: string;
  fileName?: string;
  params?: FanfouPostParams;
}): Promise<unknown> => {
  const client = getFanfouClient();
  try {
    return await client.uploadPhoto({
      photoBase64,
      status: status ?? '',
      mimeType,
      fileName,
      params: {
        ...params,
        format: 'html',
      },
    });
  } catch (err) {
    throw toFanfouError(err);
  }
};

export const uploadProfileImage = async ({
  imageBase64,
  params,
}: {
  imageBase64: string;
  params?: FanfouPostParams;
}): Promise<unknown> => {
  const client = getFanfouClient();
  try {
    return await client.uploadProfileImage({
      imageBase64,
      params: {
        ...params,
        format: 'html',
      },
    });
  } catch (err) {
    throw toFanfouError(err);
  }
};

export const requestFanfouAccessToken = async (callbackUrl: string) => {
  return getAccessToken({
    callbackUrl,
  });
};

export const resolveAuthAccessTokenIdentity = async (
  accessToken: OAuthAccessToken,
): Promise<AuthAccessToken> => {
  let resolvedUserId = accessToken.userId;
  let resolvedScreenName = accessToken.screenName;
  if (resolvedUserId) {
    resolvedUserId = resolvedUserId.trim();
  }
  if (resolvedScreenName) {
    resolvedScreenName = resolvedScreenName.trim();
  }
  try {
    if (!resolvedUserId || !resolvedScreenName) {
      const client = new FanfouClient(accessToken);
      const user = (await client.get('/account/verify_credentials', {
        mode: 'lite',
        format: 'html',
      })) as FanfouUser;
      resolvedUserId = resolvedUserId ?? user.id.trim();
      resolvedScreenName = resolvedScreenName ?? user.screen_name.trim();
    }
  } catch {
    // Keep existing token identity if API call fails.
  }

  if (!resolvedUserId || !resolvedScreenName) {
    throw new Error('Missing user identity in access token.');
  }

  return {
    oauthToken: accessToken.oauthToken,
    oauthTokenSecret: accessToken.oauthTokenSecret,
    userId: resolvedUserId,
    screenName: resolvedScreenName,
  };
};
