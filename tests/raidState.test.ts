import { cancelRaid } from '../src/api/cancelRaid'
import { getUsers, GetUsersError } from '../src/api/getUsers'
import { startARaid } from '../src/api/startARaid'
import type TwitchInstance from '../src/index'
import { RAID_OPERATION_TIMEOUT_MS, RaidState } from '../src/raidState'

const response = (body: unknown, status: number): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: jest.fn(async () => body),
  }) as unknown as Response

const nonJsonResponse = (status: number): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: jest.fn(async () => {
      throw new SyntaxError('Unexpected token')
    }),
  }) as unknown as Response

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const deferredJsonResponse = (status: number) => {
  const body = deferred<unknown>()
  const json = jest.fn(() => body.promise)
  return {
    response: {
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers(),
      json,
    } as unknown as Response,
    json,
    resolveBody: body.resolve,
  }
}

const makeInstance = () => {
  const instance = {
    auth: {
      identityGeneration: 1,
      valid: true,
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

  test('clears an acknowledged error and publishes the inactive state', () => {
    const instance = makeInstance()
    instance.raidState.markError('start', 'Target declined raids', 400)
    jest.mocked(instance.variables.updateVariables).mockClear()
    jest.mocked(instance.checkFeedbacks).mockClear()

    instance.raidState.clearError()

    expect(instance.raidState.lastError).toBeNull()
    expect(instance.raidState.errorActive()).toBe(false)
    expect(instance.variables.updateVariables).toHaveBeenCalledTimes(1)
    expect(instance.checkFeedbacks).toHaveBeenCalledWith('raidPending', 'raidError')
  })

  test('clears pending and error state when broadcaster authentication changes', () => {
    const instance = makeInstance()
    instance.raidState.markPending('target', 'Target', '2026-08-28T12:00:00Z')
    instance.raidState.markError('cancel', 'Old account error')

    instance.raidState.authenticationInvalidated()

    expect(instance.raidState.pending).toBeNull()
    expect(instance.raidState.lastError).toBeNull()
  })
})

describe('raid API state transitions', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  test('rejects a start request when cached identity remains after authentication becomes invalid', async () => {
    const instance = makeInstance()
    instance.auth.valid = false

    await expect(startARaid(instance, 'target')).resolves.toBe(false)

    expect(instance.API.getUsers).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(instance.raidState.lastError).toMatchObject({ message: 'Unable to start a raid because a valid broadcaster authentication is required.' })
    instance.raidState.destroy()
  })

  test('rejects a cancellation when cached identity remains after authentication becomes invalid', async () => {
    const instance = makeInstance()
    instance.auth.valid = false

    await expect(cancelRaid(instance)).resolves.toBe(false)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(instance.raidState.lastError).toMatchObject({ message: 'Unable to cancel a raid because a valid broadcaster authentication is required.' })
    instance.raidState.destroy()
  })

  test('marks a raid pending after Twitch accepts the start request', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(response({ data: [{ created_at: new Date().toISOString(), is_mature: false }] }, 200))

    await expect(startARaid(instance, 'target')).resolves.toBe(true)

    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'target', targetDisplayName: 'Target' })
    expect(instance.log).toHaveBeenCalledWith('info', 'Queued a raid on Target')
    instance.raidState.destroy()
  })

  test('discards a start response after the authenticated broadcaster changes', async () => {
    const instance = makeInstance()
    const oldResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(oldResponse.promise)

    const operation = startARaid(instance, 'target')
    for (let turn = 0; turn < 4; turn++) await Promise.resolve()
    instance.auth.identityGeneration++
    instance.auth.userID = 'new-broadcaster'
    instance.raidState.authenticationInvalidated()
    instance.raidState.markPending('new-target', 'New Target', new Date().toISOString())
    oldResponse.resolve(response({ data: [{ created_at: new Date().toISOString(), is_mature: false }] }, 200))

    await expect(operation).resolves.toBe(false)
    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'new-target' })
    instance.raidState.destroy()
  })

  test('discards a parsed start body after the authenticated broadcaster changes', async () => {
    const instance = makeInstance()
    const oldResponse = deferredJsonResponse(200)
    fetchMock.mockResolvedValueOnce(oldResponse.response)

    const operation = startARaid(instance, 'target')
    for (let turn = 0; turn < 8; turn++) await Promise.resolve()
    expect(oldResponse.json).toHaveBeenCalledTimes(1)
    instance.auth.identityGeneration++
    instance.auth.userID = 'new-broadcaster'
    instance.raidState.authenticationInvalidated()
    instance.raidState.markPending('new-target', 'New Target', new Date().toISOString())
    oldResponse.resolveBody({ data: [{ created_at: new Date().toISOString(), is_mature: false }] })

    await expect(operation).resolves.toBe(false)
    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'new-target' })
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

  test('preserves the HTTP status when a rejected start has a non-JSON body', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(nonJsonResponse(502))

    await expect(startARaid(instance, 'target')).resolves.toBe(false)

    expect(instance.raidState.lastError).toMatchObject({ statusCode: 502, message: 'Twitch returned HTTP 502' })
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

  test.each(['missing&login=other', '@@target', ''])('rejects invalid target login %j before looking it up', async (login) => {
    const instance = makeInstance()

    await expect(startARaid(instance, login)).resolves.toBe(false)

    expect(instance.API.getUsers).not.toHaveBeenCalled()
    expect(instance.raidState.lastError).toMatchObject({ statusCode: null, message: 'Unable to start a raid because the target login is invalid.' })
    instance.raidState.destroy()
  })

  test('preserves target lookup failures for raid diagnostics', async () => {
    const instance = makeInstance()
    jest.mocked(instance.API.getUsers).mockRejectedValueOnce(new GetUsersError('Too Many Requests', 429))

    await expect(startARaid(instance, 'target')).resolves.toBe(false)

    expect(instance.raidState.lastError).toMatchObject({ statusCode: 429, message: 'Too Many Requests' })
    expect(fetchMock).not.toHaveBeenCalled()
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

  test('discards a cancellation response after the authenticated broadcaster changes', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('old-target', 'Old Target', new Date().toISOString())
    const oldResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(oldResponse.promise)

    const operation = cancelRaid(instance)
    instance.auth.identityGeneration++
    instance.auth.userID = 'new-broadcaster'
    instance.raidState.authenticationInvalidated()
    instance.raidState.markPending('new-target', 'New Target', new Date().toISOString())
    oldResponse.resolve(response(undefined, 204))

    await expect(operation).resolves.toBe(false)
    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'new-target' })
    instance.raidState.destroy()
  })

  test('discards a parsed cancellation error after the authenticated broadcaster changes', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('old-target', 'Old Target', new Date().toISOString())
    const oldResponse = deferredJsonResponse(404)
    fetchMock.mockResolvedValueOnce(oldResponse.response)

    const operation = cancelRaid(instance)
    for (let turn = 0; turn < 4; turn++) await Promise.resolve()
    expect(oldResponse.json).toHaveBeenCalledTimes(1)
    instance.auth.identityGeneration++
    instance.auth.userID = 'new-broadcaster'
    instance.raidState.authenticationInvalidated()
    instance.raidState.markPending('new-target', 'New Target', new Date().toISOString())
    oldResponse.resolveBody({ status: 404, message: 'Not Found' })

    await expect(operation).resolves.toBe(false)
    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'new-target' })
    expect(instance.raidState.lastError).toBeNull()
    instance.raidState.destroy()
  })

  test('supersedes an earlier start before sending a later cancellation', async () => {
    const instance = makeInstance()
    const startResponse = deferredJsonResponse(200)
    fetchMock.mockResolvedValueOnce(startResponse.response).mockResolvedValueOnce(response(undefined, 204))

    const startOperation = startARaid(instance, 'target')
    for (let turn = 0; turn < 8; turn++) await Promise.resolve()
    expect(startResponse.json).toHaveBeenCalledTimes(1)
    const cancelOperation = cancelRaid(instance)
    for (let turn = 0; turn < 4; turn++) await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    startResponse.resolveBody({ data: [{ created_at: new Date().toISOString(), is_mature: false }] })

    await expect(startOperation).resolves.toBe(false)
    await expect(cancelOperation).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(instance.raidState.pending).toBeNull()
    instance.raidState.destroy()
  })

  test('aborts a stalled start so a later cancellation can proceed', async () => {
    const instance = makeInstance()
    fetchMock
      .mockImplementationOnce((_url, options) => {
        const signal = options?.signal
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      })
      .mockResolvedValueOnce(response(undefined, 204))

    const startOperation = startARaid(instance, 'target')
    for (let turn = 0; turn < 12; turn++) await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const cancelOperation = cancelRaid(instance)

    await expect(startOperation).resolves.toBe(false)
    await expect(cancelOperation).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    instance.raidState.destroy()
  })

  test('times out a stalled raid operation with operator feedback', async () => {
    jest.useFakeTimers()
    const instance = makeInstance()
    fetchMock.mockImplementationOnce((_url, options) => {
      const signal = options?.signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })

    const operation = startARaid(instance, 'target')
    for (let turn = 0; turn < 12; turn++) await Promise.resolve()
    await jest.advanceTimersByTimeAsync(RAID_OPERATION_TIMEOUT_MS)

    await expect(operation).resolves.toBe(false)
    expect(instance.raidState.lastError).toMatchObject({ message: 'Twitch raid operation timed out' })
    instance.raidState.destroy()
    jest.useRealTimers()
  })

  test('sends a later start only after an earlier cancellation completes', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('old-target', 'Old Target', new Date().toISOString())
    const cancelResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(cancelResponse.promise).mockResolvedValueOnce(response({ data: [{ created_at: new Date().toISOString(), is_mature: false }] }, 200))

    const cancelOperation = cancelRaid(instance)
    const startOperation = startARaid(instance, 'target')
    for (let turn = 0; turn < 4; turn++) await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(instance.API.getUsers).not.toHaveBeenCalled()

    cancelResponse.resolve(response(undefined, 204))

    await expect(cancelOperation).resolves.toBe(true)
    await expect(startOperation).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'target' })
    instance.raidState.destroy()
  })

  test('does not make a new broadcaster wait for a stalled old-account operation', async () => {
    const instance = makeInstance()
    const oldResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(oldResponse.promise).mockResolvedValueOnce(response({ data: [{ created_at: new Date().toISOString(), is_mature: false }] }, 200))

    const oldOperation = startARaid(instance, 'old_target')
    for (let turn = 0; turn < 12; turn++) await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    instance.auth.identityGeneration++
    instance.auth.userID = 'new-broadcaster'
    instance.raidState.authenticationInvalidated()

    const newOperation = startARaid(instance, 'new_target')
    await expect(newOperation).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'target' })

    oldResponse.resolve(response({ data: [{ created_at: new Date().toISOString(), is_mature: false }] }, 200))
    await expect(oldOperation).resolves.toBe(false)
    expect(instance.raidState.pending).toMatchObject({ targetLogin: 'target' })
    instance.raidState.destroy()
  })

  test('discards an in-flight operation after raid state is destroyed', async () => {
    const instance = makeInstance()
    const oldResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(oldResponse.promise)

    const operation = startARaid(instance, 'target')
    for (let turn = 0; turn < 4; turn++) await Promise.resolve()
    instance.raidState.destroy()
    const variableUpdatesAfterDestroy = jest.mocked(instance.variables.updateVariables).mock.calls.length
    oldResponse.resolve(response({ data: [{ created_at: new Date().toISOString(), is_mature: false }] }, 200))

    await expect(operation).resolves.toBe(false)
    expect(instance.raidState.pending).toBeNull()
    expect(instance.variables.updateVariables).toHaveBeenCalledTimes(variableUpdatesAfterDestroy)
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

  test('clears stale state and preserves status for a non-JSON 404 cancellation', async () => {
    const instance = makeInstance()
    instance.raidState.markPending('target', 'Target', new Date().toISOString())
    fetchMock.mockResolvedValueOnce(nonJsonResponse(404))

    await expect(cancelRaid(instance)).resolves.toBe(false)

    expect(instance.raidState.pending).toBeNull()
    expect(instance.raidState.lastError).toMatchObject({ statusCode: 404, message: 'Twitch returned HTTP 404' })
    instance.raidState.destroy()
  })
})

describe('user lookup request construction', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  test('encodes each login as a separate query parameter', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(response({ data: [] }, 200))

    await getUsers(instance, { type: 'login', channels: ['first', 'missing&login=other'] })

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.twitch.tv/helix/users?login=first&login=missing%26login%3Dother')
    instance.raidState.destroy()
  })

  test('reports the HTTP status when a user lookup response is not JSON', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(nonJsonResponse(502))

    await expect(getUsers(instance, { type: 'login', channels: 'target', throwOnError: true })).rejects.toMatchObject({
      name: 'GetUsersError',
      message: 'Twitch returned HTTP 502',
      statusCode: 502,
    })
    instance.raidState.destroy()
  })

  test.each([
    { body: null, status: 200, message: 'Twitch returned an invalid user lookup response' },
    { body: 'upstream failure', status: 502, message: 'Twitch returned HTTP 502' },
  ])('handles a JSON primitive user lookup response with status $status', async ({ body, status, message }) => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(response(body, status))

    await expect(getUsers(instance, { type: 'login', channels: 'target', throwOnError: true })).rejects.toMatchObject({
      name: 'GetUsersError',
      message,
      statusCode: status,
    })
    instance.raidState.destroy()
  })

  test('rejects an error response even when it contains a data array', async () => {
    const instance = makeInstance()
    fetchMock.mockResolvedValueOnce(response({ data: [] }, 502))

    await expect(getUsers(instance, { type: 'login', channels: 'target', throwOnError: true })).rejects.toMatchObject({
      name: 'GetUsersError',
      message: 'Twitch returned HTTP 502',
      statusCode: 502,
    })
    instance.raidState.destroy()
  })
})
