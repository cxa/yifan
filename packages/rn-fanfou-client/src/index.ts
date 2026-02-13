import { Linking, NativeModules } from 'react-native';

type OAuthAccessToken = {
  oauthToken: string;
  oauthTokenSecret: string;
};

const FANFOU_API_BASE_URL = 'http://api.fanfou.com';
const FANFOU_OAUTH_AUTHORIZE_URL = 'https://m.fanfou.com/oauth/authorize';

type OAuthRequestToken = {
  oauthToken: string;
  oauthTokenSecret: string;
};

type NativeRequestResponse = {
  status: number;
  body: string;
};

type NativeOAuthModule = {
  getRequestToken: (
    consumerKey: string,
    consumerSecret: string,
    callbackUrl: string,
  ) => Promise<OAuthRequestToken>;
  getAccessToken: (
    consumerKey: string,
    consumerSecret: string,
    requestToken: string,
    requestTokenSecret: string,
  ) => Promise<OAuthAccessToken>;
  request: (
    consumerKey: string,
    consumerSecret: string,
    token: string,
    tokenSecret: string,
    method: 'GET' | 'POST',
    url: string,
    params: Record<string, string>,
  ) => Promise<NativeRequestResponse>;
  uploadPhoto: (
    consumerKey: string,
    consumerSecret: string,
    token: string,
    tokenSecret: string,
    photoBase64: string,
    status: string | null,
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

const getNativeModule = (): NativeOAuthModule => {
  const module = NativeModules.FanfouOAuthModule as
    | NativeOAuthModule
    | undefined;
  if (!module) {
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

const parseBody = (body: string) => {
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

const requireToken = (tokens?: OAuthAccessToken) => {
  if (!tokens?.oauthToken || !tokens?.oauthTokenSecret) {
    throw new Error('Missing OAuth access token. Authenticate first.');
  }
  return { key: tokens.oauthToken, secret: tokens.oauthTokenSecret };
};

const nativeRequest = async (
  method: 'GET' | 'POST',
  url: string,
  params: Record<string, string>,
  token: { key: string; secret: string },
  consumerKey: string,
  consumerSecret: string,
): Promise<NativeRequestResponse> => {
  const response = await getNativeModule().request(
    consumerKey,
    consumerSecret,
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
  private consumerKey: string;
  private consumerSecret: string;
  private tokens?: OAuthAccessToken;

  public constructor(
    consumerKey: string,
    consumerSecret: string,
    tokens?: OAuthAccessToken,
  ) {
    if (!consumerKey || !consumerSecret) {
      throw new Error('Missing consumer key or secret.');
    }
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.tokens = tokens;
  }

  public getAccessToken = async (
    callbackUrl: string,
  ): Promise<OAuthAccessToken> => {
    if (!callbackUrl) {
      throw new Error(
        'Missing OAuth callback URL. Provide callbackUrl before authentication.',
      );
    }
    const requestToken = await this.getRequestToken(callbackUrl);
    this.tokens = undefined;
    const authorizeUrl = this.getAuthorizeUrl(requestToken, callbackUrl);
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
      this.consumerKey,
      this.consumerSecret,
      requestToken.oauthToken,
      requestToken.oauthTokenSecret,
    );

    if (!response?.oauthToken || !response?.oauthTokenSecret) {
      throw new Error('Invalid access token response');
    }

    this.tokens = response;
    return response;
  };

  private getRequestToken = async (
    callbackUrl: string,
  ): Promise<OAuthRequestToken> => {
    const response = await getNativeModule().getRequestToken(
      this.consumerKey,
      this.consumerSecret,
      callbackUrl,
    );

    if (!response?.oauthToken || !response?.oauthTokenSecret) {
      throw new Error('Invalid request token response');
    }

    return response;
  };

  private getAuthorizeUrl = (
    requestToken: OAuthRequestToken,
    callbackUrl: string,
  ) => {
    const query = buildQuery({
      oauth_token: requestToken.oauthToken,
      oauth_callback: callbackUrl,
    });
    return `${FANFOU_OAUTH_AUTHORIZE_URL}?${query}`;
  };

  private buildEndpointUrl = (endpoint: string) => {
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const withJson = normalized.endsWith('.json')
      ? normalized
      : `${normalized}.json`;
    return `${FANFOU_API_BASE_URL}${withJson}`;
  };

  public get = async <T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> => {
    const token = requireToken(this.tokens);
    const normalized = normalizeParams(params);
    const url = this.buildEndpointUrl(endpoint);
    const response = await nativeRequest(
      'GET',
      url,
      normalized,
      token,
      this.consumerKey,
      this.consumerSecret,
    );
    const data = parseBody(response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new FanfouApiError('API GET failed', {
        status: response.status,
        url,
        body: response.body,
        data,
      });
    }

    return data as T;
  };

  public post = async <T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> => {
    const token = requireToken(this.tokens);
    const normalized = normalizeParams(params);
    const url = this.buildEndpointUrl(endpoint);
    const response = await nativeRequest(
      'POST',
      url,
      normalized,
      token,
      this.consumerKey,
      this.consumerSecret,
    );
    const data = parseBody(response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new FanfouApiError('API POST failed', {
        status: response.status,
        url,
        body: response.body,
        data,
      });
    }

    return data as T;
  };

  public uploadPhoto = async <T = unknown>({
    photoBase64,
    status,
    params,
  }: {
    photoBase64: string;
    status?: string;
    params?: Record<string, string | number | boolean | undefined>;
  }): Promise<T> => {
    const token = requireToken(this.tokens);
    const normalized = normalizeParams(params);
    const response = await getNativeModule().uploadPhoto(
      this.consumerKey,
      this.consumerSecret,
      token.key,
      token.secret,
      photoBase64,
      status ?? null,
      normalized,
    );
    const data = parseBody(response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new FanfouApiError('API upload photo failed', {
        status: response.status,
        url: `${FANFOU_API_BASE_URL}/photos/upload.json`,
        body: response.body,
        data,
      });
    }

    return data as T;
  };
}
