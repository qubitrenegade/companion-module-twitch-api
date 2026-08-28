import { Auth } from '../src/auth'
import type TwitchInstance from '../src/index'

const response = (body: unknown): Response =>
  ({
    json: jest.fn(async () => body),
  }) as unknown as Response

describe('device-code authentication startup', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  test('validates the broadcaster identity before starting the raid browser', async () => {
    let auth!: Auth
    const authenticationInvalidated = jest.fn(() => {
      expect(auth.userID).toBe('')
      expect(auth.valid).toBe(false)
    })
    const raidStateInvalidated = jest.fn()
    const authenticationReady = jest.fn(() => {
      expect(auth.userID).toBe('new-user-id')
      expect(auth.valid).toBe(true)
    })
    const instance = {
      config: { accessToken: '', refreshToken: '' },
      saveConfig: jest.fn(),
      log: jest.fn(),
      chat: { init: jest.fn() },
      updateInstance: jest.fn(),
      API: { initialPoll: jest.fn(), pollData: jest.fn() },
      raidBrowser: { authenticationInvalidated, authenticationReady },
      raidState: { authenticationInvalidated: raidStateInvalidated },
    } as unknown as TwitchInstance
    auth = new Auth(instance)
    Object.defineProperty(instance, 'auth', { value: auth })

    fetchMock
      .mockResolvedValueOnce(response({ device_code: 'device', expires_in: 600, interval: 1, user_code: 'ABCD', verification_uri: 'https://example.com' }))
      .mockResolvedValueOnce(response({ access_token: 'new-access', expires_in: 3600, refresh_token: 'new-refresh', scope: ['channel:manage:raids'], token_type: 'bearer' }))
      .mockResolvedValueOnce(response({ client_id: 'client', login: 'new-user', scopes: ['channel:manage:raids'], user_id: 'new-user-id', expires_in: 3600 }))

    await auth.generateDeviceCode()
    for (let turn = 0; turn < 8; turn++) await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(authenticationInvalidated).toHaveBeenCalledTimes(1)
    expect(raidStateInvalidated).toHaveBeenCalledTimes(1)
    expect(authenticationReady).toHaveBeenCalledTimes(1)
    expect(authenticationInvalidated.mock.invocationCallOrder[0]).toBeLessThan(authenticationReady.mock.invocationCallOrder[0])
    expect(instance.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-access', refreshToken: 'new-refresh' }))

    auth.destroy()
  })

  test('clears broadcaster-owned state when token refresh fails permanently', async () => {
    const authenticationInvalidated = jest.fn()
    const raidStateInvalidated = jest.fn()
    const instance = {
      config: { accessToken: 'old-access', refreshToken: 'old-refresh' },
      saveConfig: jest.fn(),
      log: jest.fn(),
      raidBrowser: { authenticationInvalidated },
      raidState: { authenticationInvalidated: raidStateInvalidated },
    } as unknown as TwitchInstance
    const auth = new Auth(instance)
    Object.defineProperty(instance, 'auth', { value: auth })
    auth.valid = true
    auth.login = 'old-user'
    auth.userID = 'old-user-id'
    auth.scopes = ['channel:manage:raids']

    fetchMock.mockResolvedValueOnce(response({ status: 401, message: 'Invalid OAuth token' })).mockResolvedValueOnce(response({ status: 400, message: 'Invalid refresh token' }))

    auth.init()
    for (let turn = 0; turn < 16; turn++) await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(auth).toMatchObject({ valid: false, login: '', userID: '', scopes: [], accessToken: '', refreshToken: '' })
    expect(authenticationInvalidated).toHaveBeenCalledTimes(1)
    expect(raidStateInvalidated).toHaveBeenCalledTimes(1)
    expect(instance.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ accessToken: '', refreshToken: '' }))

    auth.destroy()
  })
})
