import { FanfouClient, getAccessToken } from 'rn-fanfou-client';

import type { AuthAccessToken } from './secure-token-storage';

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
  return client.get(endpoint, {
    ...params,
    format: 'html',
  });
};

export const post = async (
  endpoint: string,
  params?: FanfouPostParams,
): Promise<unknown> => {
  const client = getFanfouClient();
  return client.post(endpoint, {
    ...params,
    format: 'html',
  });
};

export const uploadPhoto = async ({
  photoBase64,
  status,
  params,
}: {
  photoBase64: string;
  status?: string;
  params?: FanfouPostParams;
}): Promise<unknown> => {
  const client = getFanfouClient();
  return client.uploadPhoto({
    photoBase64,
    status,
    params: {
      ...params,
      format: 'html',
    },
  });
};

export const requestFanfouAccessToken = async (callbackUrl: string) => {
  return getAccessToken({
    callbackUrl,
  });
};
