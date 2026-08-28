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
    expect(instance.checkFeedbacks).toHaveBeenCalledWith('raidPending', 'raidError')
  })

  test('publishes a visible error window while retaining diagnostic details', () => {
    const instance = makeInstance()

    instance.raidState.markError('start', 'Too Many Requests', 429)

    expect(instance.raidState.errorActive()).toBe(true)
    expect(instance.raidState.lastError).toMatchObject({ operation: 'start', statusCode: 429, message: 'Too Many Requests' })

    jest.advanceTimersByTime(15_000)

    expect(instance.raidState.errorActive()).toBe(false)
    expect(instance.raidState.lastError).toMatchObject({ operation: 'start', statusCode: 429, message: 'Too Many Requests' })
  })

  test('represents a non-HTTP error without inventing a status code', () => {
    const instance = makeInstance()

    instance.raidState.markError('cancel', 'Network unavailable')

    expect(instance.raidState.lastError).toMatchObject({ operation: 'cancel', statusCode: null, message: 'Network unavailable' })
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
    expect(instance.raidState.lastError).toMatchObject({ statusCode: 400, message: 'The channel is not in a raidable state' })
    expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('Failed to Start A Raid'))
    instance.raidState.destroy()
  })

  test('publishes Twitch raid rate-limit details for operator feedback', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(
      response(
        {
          error: 'Too Many Requests',
          status: 429,
          message: 'The broadcaster exceeded the number of raid requests that they may make. The limit is 10 requests within a 10-minute window.',
        },
        429,
      ),
    )

    await expect(startARaid(instance, 'target')).resolves.toBe(false)

    expect(instance.raidState.lastError).toMatchObject({
      statusCode: 429,
      message: 'The broadcaster exceeded the number of raid requests that they may make. The limit is 10 requests within a 10-minute window.',
    })
    expect(instance.raidState.errorActive()).toBe(true)
    instance.raidState.destroy()
  })

  test('clears pending state after Twitch accepts a cancellation', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('target', 'Target', new Date().toISOString())
    fetchMock.mockResolvedValueOnce(response(undefined, 204))

    await expect(cancelRaid(instance)).resolves.toBe(true)

    expect(instance.raidState.pending).toBeNull()
    instance.raidState.destroy()
    expect(instance.log).toHaveBeenCalledWith('info', 'Canceled the pending raid on Target')
  })

  test('clears stale local state when Twitch reports no pending raid', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('target', 'Target', new Date().toISOString())
    fetchMock.mockResolvedValueOnce(response({ status: 404, message: 'Not Found' }, 404))

    await expect(cancelRaid(instance)).resolves.toBe(false)

    expect(instance.raidState.pending).toBeNull()
    expect(instance.raidState.lastError).toMatchObject({ statusCode: 404, message: 'Not Found' })
    instance.raidState.destroy()
  })
})
