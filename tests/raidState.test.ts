import { cancelRaid } from '../src/api/cancelRaid'
import { startARaid } from '../src/api/startARaid'
import type TwitchInstance from '../src/index'
import { RaidState } from '../src/raidState'

const response = (body: unknown, status: number): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: jest.fn(async () => body),
  }) as unknown as Response

const makeInstance = () => {
  const instance = {
    auth: {
      userID: 'self',
      scopes: ['channel:manage:raids'],
    },
    API: {
      defaultOptions: jest.fn(() => ({ method: 'GET', headers: {} })),
      getUsers: jest.fn(async () => [{ id: 'target-id', login: 'target', display_name: 'Target' }]),
      updateRatelimits: jest.fn(),
    },
    variables: { updateVariables: jest.fn() },
    checkFeedbacks: jest.fn(),
    log: jest.fn(),
  } as unknown as TwitchInstance
  Object.defineProperty(instance, 'raidState', { value: new RaidState(instance), enumerable: true })
  return instance
}

describe('raid countdown state', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-08-28T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('publishes a 90-second local pending window and expires it', () => {
    const instance = makeInstance()

    instance.raidState.markPending('target', 'Target', '2026-08-28T12:00:00Z')

    expect(instance.raidState.pending).toMatchObject({
      targetLogin: 'target',
      targetDisplayName: 'Target',
      expiresAt: '2026-08-28T12:01:30.000Z',
    })
    expect(instance.raidState.remainingSeconds()).toBe(90)

    jest.advanceTimersByTime(90_000)

    expect(instance.raidState.pending).toBeNull()
    expect(instance.checkFeedbacks).toHaveBeenCalledWith('raidPending')
  })
})

describe('raid API state transitions', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  test('marks a raid pending after Twitch accepts the start request', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(response({ data: [{ created_at: new Date().toISOString(), is_mature: false }] }, 200))

    await expect(startARaid(instance, 'target')).resolves.toBe(true)

    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'target', targetDisplayName: 'Target' })
    expect(instance.log).toHaveBeenCalledWith('info', 'Queued a raid on Target')
    instance.raidState.destroy()
  })

  test('does not create pending state when Twitch rejects the start request', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(response({ status: 400, message: 'The channel is not in a raidable state' }, 400))

    await expect(startARaid(instance, 'target')).resolves.toBe(false)

    expect(instance.raidState.pending).toBeNull()
    expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('Failed to Start A Raid'))
  })

  test('clears pending state after Twitch accepts a cancellation', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('target', 'Target', new Date().toISOString())
    fetchMock.mockResolvedValueOnce(response(undefined, 204))

    await expect(cancelRaid(instance)).resolves.toBe(true)

    expect(instance.raidState.pending).toBeNull()
    expect(instance.log).toHaveBeenCalledWith('info', 'Canceled the pending raid on Target')
  })

  test('clears stale local state when Twitch reports no pending raid', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('target', 'Target', new Date().toISOString())
    fetchMock.mockResolvedValueOnce(response({ status: 404, message: 'Not Found' }, 404))

    await expect(cancelRaid(instance)).resolves.toBe(false)

    expect(instance.raidState.pending).toBeNull()
  })
})
