const mockGetRequestToken = jest.fn();
const mockGetAccessToken = jest.fn();
const mockRequest = jest.fn();
const mockUploadPhoto = jest.fn();
const mockUploadProfileImage = jest.fn();
const mockOpenAuth = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {
    FanfouOAuthModule: {
      getRequestToken: (...args: unknown[]) => mockGetRequestToken(...args),
      getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
      request: (...args: unknown[]) => mockRequest(...args),
      uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
      uploadProfileImage: (...args: unknown[]) =>
        mockUploadProfileImage(...args),
    },
  },
}));

jest.mock('react-native-inappbrowser-reborn', () => ({
  __esModule: true,
  default: {
    openAuth: (...args: unknown[]) => mockOpenAuth(...args),
  },
}));

import { FanfouClient, getAccessToken } from 'rn-fanfou-client';

const OAUTH_CALLBACK_URL = 'gohan://authorize_callback';

describe('FanfouClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAccessToken opens authorize URL in InAppBrowser and resolves access token', async () => {
    mockGetRequestToken.mockResolvedValueOnce({
      oauthToken: 'rt',
      oauthTokenSecret: 'rs',
    });
    mockGetAccessToken.mockResolvedValueOnce({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
      userId: '1',
      screenName: 'gohan',
    });
    mockOpenAuth.mockResolvedValueOnce({
      type: 'success',
      url: `${OAUTH_CALLBACK_URL}?oauth_token=rt`,
    });

    const accessToken = await getAccessToken({ callbackUrl: OAUTH_CALLBACK_URL });

    expect(mockGetRequestToken).toHaveBeenCalledWith(OAUTH_CALLBACK_URL);
    expect(mockOpenAuth).toHaveBeenCalledWith(
      'https://m.fanfou.com/oauth/authorize?oauth_token=rt&oauth_callback=gohan%3A%2F%2Fauthorize_callback',
      OAUTH_CALLBACK_URL,
      expect.any(Object),
    );
    expect(accessToken).toEqual({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
      userId: '1',
      screenName: 'gohan',
    });
    expect(mockGetAccessToken).toHaveBeenCalledWith('rt', 'rs');
  });

  test('getAccessToken rejects when user cancels InAppBrowser', async () => {
    mockGetRequestToken.mockResolvedValueOnce({
      oauthToken: 'rt',
      oauthTokenSecret: 'rs',
    });
    mockOpenAuth.mockResolvedValueOnce({ type: 'cancel' });

    await expect(
      getAccessToken({ callbackUrl: OAUTH_CALLBACK_URL }),
    ).rejects.toThrow('cancelled');

    expect(mockGetAccessToken).not.toHaveBeenCalled();
  });

  test('get parses JSON response body', async () => {
    mockRequest.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ ok: true }),
    });

    const client = new FanfouClient({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
    });

    const response = await client.get('/statuses/home_timeline');

    expect(response).toEqual({ ok: true });
    expect(mockRequest).toHaveBeenCalledWith(
      'at',
      'as',
      'GET',
      'http://api.fanfou.com/statuses/home_timeline.json',
      {},
    );
  });

  test('post throws on non-2xx', async () => {
    mockRequest.mockResolvedValueOnce({
      status: 401,
      body: JSON.stringify({ error: 'unauthorized' }),
    });

    const client = new FanfouClient({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
    });

    await expect(
      client.post('/statuses/update', { status: 'hi' }),
    ).rejects.toMatchObject({
      name: 'FanfouApiError',
      status: 401,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      'at',
      'as',
      'POST',
      'http://api.fanfou.com/statuses/update.json',
      { status: 'hi' },
    );
  });

  test('post prefers api error field as error message', async () => {
    mockRequest.mockResolvedValueOnce({
      status: 403,
      body: JSON.stringify({ error: 'rate limit exceeded' }),
    });

    const client = new FanfouClient({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
    });

    await expect(
      client.post('/statuses/update', { status: 'hi' }),
    ).rejects.toMatchObject({
      name: 'FanfouApiError',
      status: 403,
      message: 'rate limit exceeded',
    });
  });

  test('constructor throws if access token is missing', () => {
    expect(
      () =>
        new FanfouClient({
          oauthToken: '',
          oauthTokenSecret: '',
        }),
    ).toThrow('Missing OAuth access token. Authenticate first.');
  });

  test('uploadPhoto calls native module and parses response', async () => {
    mockUploadPhoto.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ id: '1' }),
    });

    const client = new FanfouClient({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
    });

    const response = await client.uploadPhoto({
      photoBase64: 'base64',
      status: 'hello',
      params: { foo: 'bar' },
    });

    expect(response).toEqual({ id: '1' });
    expect(mockUploadPhoto).toHaveBeenCalledWith(
      'at',
      'as',
      'base64',
      'hello',
      { foo: 'bar' },
    );
  });

  test('uploadPhoto prefers api error field as error message', async () => {
    mockUploadPhoto.mockResolvedValueOnce({
      status: 413,
      body: JSON.stringify({ error: 'photo too large' }),
    });

    const client = new FanfouClient({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
    });

    await expect(
      client.uploadPhoto({
        photoBase64: 'base64',
      }),
    ).rejects.toMatchObject({
      name: 'FanfouApiError',
      status: 413,
      message: 'photo too large',
    });
  });

  test('uploadProfileImage calls native module and parses response', async () => {
    mockUploadProfileImage.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ id: '1' }),
    });

    const client = new FanfouClient({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
    });

    const response = await client.uploadProfileImage({
      imageBase64: 'base64',
      params: { foo: 'bar' },
    });

    expect(response).toEqual({ id: '1' });
    expect(mockUploadProfileImage).toHaveBeenCalledWith('at', 'as', 'base64', {
      foo: 'bar',
    });
  });

  test('uploadProfileImage prefers api error field as error message', async () => {
    mockUploadProfileImage.mockResolvedValueOnce({
      status: 400,
      body: JSON.stringify({ error: 'invalid image' }),
    });

    const client = new FanfouClient({
      oauthToken: 'at',
      oauthTokenSecret: 'as',
    });

    await expect(
      client.uploadProfileImage({
        imageBase64: 'base64',
      }),
    ).rejects.toMatchObject({
      name: 'FanfouApiError',
      status: 400,
      message: 'invalid image',
    });
  });
});
