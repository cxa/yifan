import { Linking, NativeModules } from 'react-native';

export type OAuthAccessToken = {
  oauthToken: string;
  oauthTokenSecret: string;
  userId?: string;
  screenName?: string;
};

const FANFOU_API_BASE_URL = 'http://api.fanfou.com';
const FANFOU_OAUTH_AUTHORIZE_URL = 'https://m.fanfou.com/oauth/authorize';
const FANFOU_UPDATE_PROFILE_IMAGE_ENDPOINT = '/account/update_profile_image';

type OAuthRequestToken = {
  oauthToken: string;
  oauthTokenSecret: string;
};

type NativeRequestResponse = {
  status: number;
  body: string;
};

type NativeOAuthModule = {
  getRequestToken: (callbackUrl: string) => Promise<OAuthRequestToken>;
  getAccessToken: (
    requestToken: string,
    requestTokenSecret: string,
  ) => Promise<OAuthAccessToken>;
  request: (
    token: string,
    tokenSecret: string,
    method: 'GET' | 'POST',
    url: string,
    params: Record<string, string>,
  ) => Promise<NativeRequestResponse>;
  uploadPhoto: (
    token: string,
    tokenSecret: string,
    photoBase64: string,
    status: string | null,
    params: Record<string, string>,
  ) => Promise<NativeRequestResponse>;
  uploadProfileImage: (
    token: string,
    tokenSecret: string,
    imageBase64: string,
    params: Record<string, string>,
  ) => Promise<NativeRequestResponse>;
};

export class FanfouApiError extends Error {
  status: number;
  url: string;
  body: string;
  data?: unknown;

  constructor(
    message: string,
    opts: { status: number; url: string; body: string; data?: unknown },
  ) {
    super(message);
    this.name = 'FanfouApiError';
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
    this.data = opts.data;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNativeOAuthModule = (value: unknown): value is NativeOAuthModule =>
  isRecord(value) &&
  typeof value.getRequestToken === 'function' &&
  typeof value.getAccessToken === 'function' &&
  typeof value.request === 'function' &&
  typeof value.uploadPhoto === 'function' &&
  typeof value.uploadProfileImage === 'function';

const getNativeModule = (): NativeOAuthModule => {
  const module = NativeModules.FanfouOAuthModule;
  if (!isNativeOAuthModule(module)) {
    throw new Error('FanfouOAuthModule is not linked. Run native builds.');
  }
  return module;
};

const normalizeParams = (
  params?: Record<string, string | number | boolean | undefined>,
): Record<string, string> => {
  if (!params) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
};

const buildQuery = (params: Record<string, string>) => {
  const search = new URLSearchParams(params);
  return search.toString();
};

const extractParams = (url: string) => {
  const params = new URLSearchParams();
  const queryIndex = url.indexOf('?');
  const fragmentIndex = url.indexOf('#');

  const query =
    queryIndex >= 0
      ? url.slice(
          queryIndex + 1,
          fragmentIndex >= 0 ? fragmentIndex : undefined,
        )
      : '';
  const fragment = fragmentIndex >= 0 ? url.slice(fragmentIndex + 1) : '';

  if (query) {
    new URLSearchParams(query).forEach((value, key) => {
      params.append(key, value);
    });
  }
  if (fragment) {
    new URLSearchParams(fragment).forEach((value, key) => {
      params.append(key, value);
    });
  }

  return params;
};

const parseCallbackUrl = (url: string) => {
  const params = extractParams(url);
  return {
    oauthToken: params.get('oauth_token') ?? undefined,
    error: params.get('error') ?? undefined,
  };
};

const waitForCallbackUrl = (callbackUrl: string) =>
  new Promise<string>((resolve, reject) => {
    let settled = false;
    const complete = (url: string) => {
      if (settled) {
        return;
      }
      settled = true;
      subscription.remove();
      resolve(url);
    };

    const subscription = Linking.addEventListener('url', event => {
      if (event.url.startsWith(callbackUrl)) {
        complete(event.url);
      }
    });

    Linking.getInitialURL()
      .then(url => {
        if (url && url.startsWith(callbackUrl)) {
          complete(url);
        }
      })
      .catch(error => {
        if (!settled) {
          subscription.remove();
          reject(error);
        }
      });
  });

const parseBody = (body: string): unknown => {
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

const extractApiErrorMessage = (data: unknown): string | null => {
  if (!isRecord(data)) {
    return null;
  }
  const apiError = data.error;
  if (typeof apiError !== 'string') {
    return null;
  }
  const normalized = apiError.trim();
  return normalized.length > 0 ? normalized : null;
};

const requireAccessToken = (accessToken: OAuthAccessToken) => {
  if (!accessToken?.oauthToken || !accessToken?.oauthTokenSecret) {
    throw new Error('Missing OAuth access token. Authenticate first.');
  }
  return {
    key: accessToken.oauthToken,
    secret: accessToken.oauthTokenSecret,
  };
};

const getRequestToken = async (
  callbackUrl: string,
): Promise<OAuthRequestToken> => {
  const response = await getNativeModule().getRequestToken(callbackUrl);

  if (!response?.oauthToken || !response?.oauthTokenSecret) {
    throw new Error('Invalid request token response');
  }

  return response;
};

const getAuthorizeUrl = (
  requestToken: OAuthRequestToken,
  callbackUrl: string,
) => {
  const query = buildQuery({
    oauth_token: requestToken.oauthToken,
    oauth_callback: callbackUrl,
  });
  return `${FANFOU_OAUTH_AUTHORIZE_URL}?${query}`;
};

export const getAccessToken = async ({
  callbackUrl,
}: {
  callbackUrl: string;
}): Promise<OAuthAccessToken> => {
  if (!callbackUrl) {
    throw new Error(
      'Missing OAuth callback URL. Provide callbackUrl before authentication.',
    );
  }
  const requestToken = await getRequestToken(callbackUrl);
  const authorizeUrl = getAuthorizeUrl(requestToken, callbackUrl);
  await Linking.openURL(authorizeUrl);
  const callbackResult = await waitForCallbackUrl(callbackUrl);
  const { oauthToken, error } = parseCallbackUrl(callbackResult);
  if (error) {
    throw new Error(error);
  }
  if (!oauthToken) {
    throw new Error('Missing oauth_token in callback URL.');
  }
  if (oauthToken !== requestToken.oauthToken) {
    throw new Error('Callback oauth_token does not match request token.');
  }
  const response = await getNativeModule().getAccessToken(
    requestToken.oauthToken,
    requestToken.oauthTokenSecret,
  );

  if (!response?.oauthToken || !response?.oauthTokenSecret) {
    throw new Error('Invalid access token response');
  }

  return response;
};

const nativeRequest = async (
  method: 'GET' | 'POST',
  url: string,
  params: Record<string, string>,
  token: { key: string; secret: string },
): Promise<NativeRequestResponse> => {
  const response = await getNativeModule().request(
    token.key,
    token.secret,
    method,
    url,
    params,
  );

  if (!response || typeof response.status !== 'number') {
    throw new Error('Invalid response from native OAuth module.');
  }

  return response;
};

export class FanfouClient {
  private readonly accessToken: OAuthAccessToken;

  public constructor(accessToken: OAuthAccessToken) {
    if (!accessToken?.oauthToken || !accessToken?.oauthTokenSecret) {
      throw new Error('Missing OAuth access token. Authenticate first.');
    }
    this.accessToken = accessToken;
  }

  private buildEndpointUrl = (endpoint: string) => {
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const withJson = normalized.endsWith('.json')
      ? normalized
      : `${normalized}.json`;
    return `${FANFOU_API_BASE_URL}${withJson}`;
  };

  public get = async (
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<unknown> => {
    const token = requireAccessToken(this.accessToken);
    const normalized = normalizeParams(params);
    const url = this.buildEndpointUrl(endpoint);
    const response = await nativeRequest('GET', url, normalized, token);
    const data = parseBody(response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new FanfouApiError(
        extractApiErrorMessage(data) ?? 'API GET failed',
        {
          status: response.status,
          url,
          body: response.body,
          data,
        },
      );
    }

    return data;
  };

  public post = async (
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<unknown> => {
    const token = requireAccessToken(this.accessToken);
    const normalized = normalizeParams(params);
    const url = this.buildEndpointUrl(endpoint);
    const response = await nativeRequest('POST', url, normalized, token);
    const data = parseBody(response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new FanfouApiError(
        extractApiErrorMessage(data) ?? 'API POST failed',
        {
          status: response.status,
          url,
          body: response.body,
          data,
        },
      );
    }

    return data;
  };

  public uploadPhoto = async ({
    photoBase64,
    status,
    params,
  }: {
    photoBase64: string;
    status?: string;
    params?: Record<string, string | number | boolean | undefined>;
  }): Promise<unknown> => {
    const token = requireAccessToken(this.accessToken);
    const normalized = normalizeParams(params);
    const response = await getNativeModule().uploadPhoto(
      token.key,
      token.secret,
      photoBase64,
      status ?? null,
      normalized,
    );
    const data = parseBody(response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new FanfouApiError(
        extractApiErrorMessage(data) ?? 'API upload photo failed',
        {
          status: response.status,
          url: `${FANFOU_API_BASE_URL}/photos/upload.json`,
          body: response.body,
          data,
        },
      );
    }

    return data;
  };

  public uploadProfileImage = async ({
    imageBase64,
    params,
  }: {
    imageBase64: string;
    params?: Record<string, string | number | boolean | undefined>;
  }): Promise<unknown> => {
    const token = requireAccessToken(this.accessToken);
    const normalized = normalizeParams(params);
    const url = this.buildEndpointUrl(FANFOU_UPDATE_PROFILE_IMAGE_ENDPOINT);
    const response = await getNativeModule().uploadProfileImage(
      token.key,
      token.secret,
      imageBase64,
      normalized,
    );
    const data = parseBody(response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new FanfouApiError(
        extractApiErrorMessage(data) ?? 'API upload profile image failed',
        {
          status: response.status,
          url,
          body: response.body,
          data,
        },
      );
    }

    return data;
  };
}
