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
      raidBrowser: { authenticationReady },
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
    expect(authenticationReady).toHaveBeenCalledTimes(1)
    expect(instance.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-access', refreshToken: 'new-refresh' }))

    auth.destroy()
  })
})
