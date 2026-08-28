import { getActions } from '../src/actions'
import { Auth } from '../src/auth'
import type { Config } from '../src/config'
import { getUpgrades } from '../src/upgrade'
import { getPresets } from '../src/presets'
import {
  mergeRaidCandidateGroups,
  normalizeRaidCandidates,
  parseRaidBrowserTeams,
  parseSuggestedRaidLogin,
  preserveRaidCandidateSelection,
  RaidBrowser,
  type RaidCandidate,
  selectWrappedRaidCandidateIndex,
  type TwitchStream,
} from '../src/raidBrowser'
import type TwitchInstance from '../src/index'

const stream = (id: string, viewers: number, name = `User ${id}`): TwitchStream => ({
  user_id: id,
  user_login: `user${id}`,
  user_name: name,
  game_name: `Game ${id}`,
  title: `Title ${id}`,
  viewer_count: viewers,
  tags: [`Tag ${id}`],
  language: 'en',
  started_at: '2026-08-28T00:00:00Z',
  thumbnail_url: `https://example.com/${id}/{width}x{height}.jpg`,
})

const candidate = (id: string, viewers = 1, sourceName = 'Team A'): RaidCandidate => ({
  userId: id,
  login: `user${id}`,
  displayName: `User ${id}`,
  viewers,
  category: `Game ${id}`,
  title: `Title ${id}`,
  tags: [`Tag ${id}`],
  language: 'en',
  startedAt: '2026-08-28T00:00:00Z',
  thumbnailUrl: `https://example.com/${id}/{width}x{height}.jpg`,
  sourceType: sourceName === 'Followed' ? 'followed' : 'team',
  sourceName,
})

const response = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: async () => body,
  }) as Response

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const makeInstance = (config: Partial<Config> = {}, scopes: string[] = ['user:read:follows']) => {
  const instance = {
    config: {
      raidBrowserEnabled: true,
      raidBrowserTeams: '',
      raidBrowserIncludeFollowed: true,
      raidBrowserRefreshSeconds: 60,
      ...config,
    },
    auth: {
      valid: true,
      userID: 'self',
      scopes,
    },
    API: {
      defaultOptions: jest.fn(() => ({ method: 'GET', headers: {} })),
      updateRatelimits: jest.fn(),
    },
    raidCandidates: [] as RaidCandidate[],
    raidCandidateIndex: 0,
    variables: { updateVariables: jest.fn() },
    checkFeedbacks: jest.fn(),
    log: jest.fn(),
  } as unknown as TwitchInstance

  return { instance, browser: new RaidBrowser(instance) }
}

describe('raid candidate transforms', () => {
  test('normalizes team candidates', () => {
    expect(normalizeRaidCandidates([stream('1', 45)], 'team', 'Team A')).toEqual([candidate('1', 45)])
  })

  test('normalizes followed-stream candidates', () => {
    expect(normalizeRaidCandidates([stream('2', 12)], 'followed', 'Followed')).toEqual([candidate('2', 12, 'Followed')])
  })

  test('tolerates streams that omit optional raid display metadata', () => {
    const minimalStream = stream('3', 9)
    delete minimalStream.tags
    delete minimalStream.language
    delete minimalStream.started_at
    delete minimalStream.thumbnail_url

    expect(normalizeRaidCandidates([minimalStream], 'team', 'Team A')[0]).toMatchObject({
      tags: [],
      language: '',
      startedAt: '',
      thumbnailUrl: '',
    })
  })

  test('parses comma and newline separated teams without duplicate names', () => {
    expect(parseRaidBrowserTeams(' Alpha, beta\nALPHA, Gamma ')).toEqual(['Alpha', 'beta', 'Gamma'])
  })

  test('extracts only an explicit up-next Twitch login', () => {
    expect(parseSuggestedRaidLogin('Drum and bass. Up next: @PlethoTechno!')).toBe('plethotechno')
    expect(parseSuggestedRaidLogin('Live with @guest, raid later')).toBe('')
  })

  test('sorts within sources, preserves source priority, deduplicates, and excludes self', () => {
    const merged = mergeRaidCandidateGroups(
      [[candidate('1', 5), candidate('2', 50), candidate('self', 100)], [candidate('2', 500, 'Team B'), candidate('3', 20, 'Team B')], [candidate('4', 10, 'Followed')]],
      'self',
    )

    expect(merged.map(({ userId, sourceName, viewers }) => ({ userId, sourceName, viewers }))).toEqual([
      { userId: '2', sourceName: 'Team A', viewers: 50 },
      { userId: '1', sourceName: 'Team A', viewers: 5 },
      { userId: '3', sourceName: 'Team B', viewers: 20 },
      { userId: '4', sourceName: 'Followed', viewers: 10 },
    ])
  })

  test('wraps next and previous selection and handles an empty list', () => {
    expect(selectWrappedRaidCandidateIndex(2, 3, 1)).toBe(0)
    expect(selectWrappedRaidCandidateIndex(0, 3, -1)).toBe(2)
    expect(selectWrappedRaidCandidateIndex(4, 0, 1)).toBe(0)
  })

  test('preserves a selected user after refresh and clamps when it disappears', () => {
    const before = [candidate('1'), candidate('2'), candidate('3')]
    expect(preserveRaidCandidateSelection(before, 1, [candidate('2'), candidate('1')])).toBe(0)
    expect(preserveRaidCandidateSelection(before, 2, [candidate('4'), candidate('5')])).toBe(1)
    expect(preserveRaidCandidateSelection(before, 1, [])).toBe(0)
  })
})

describe('RaidBrowser Twitch loading', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  test('loads team candidates even when the follows scope is missing', async () => {
    const { instance, browser } = makeInstance({ raidBrowserTeams: 'alpha' }, [])
    fetchMock
      .mockResolvedValueOnce(response({ data: [{ team_name: 'alpha', team_display_name: 'Alpha', users: [{ user_id: '1' }] }] }))
      .mockResolvedValueOnce(response({ data: [stream('1', 15)] }))

    await browser.refresh()

    expect(instance.raidCandidates).toEqual([candidate('1', 15, 'Alpha')])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('user:read:follows'))
  })

  test('retrieves every page of followed live streams', async () => {
    const { instance, browser } = makeInstance()
    fetchMock
      .mockResolvedValueOnce(response({ data: [stream('1', 10)], pagination: { cursor: 'next page' } }))
      .mockResolvedValueOnce(response({ data: [stream('2', 20)], pagination: {} }))

    await browser.refresh()

    expect(instance.raidCandidates.map((item) => item.userId)).toEqual(['2', '1'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('after=next+page')
    expect(browser.diagnostics).toMatchObject({
      status: 'ready',
      lastError: '',
      sourceSummary: 'Followed: 2 live',
    })
    expect(browser.diagnostics.lastRefreshAt).not.toBe('')
    expect(instance.log).toHaveBeenCalledWith('info', 'Raid browser refresh complete: 2 candidates (Followed: 2 live)')
  })

  test('keeps successful sources when another team fails', async () => {
    const { instance, browser } = makeInstance({ raidBrowserTeams: 'broken,good', raidBrowserIncludeFollowed: false })
    fetchMock
      .mockResolvedValueOnce(response({ data: [] }))
      .mockResolvedValueOnce(response({ data: [{ team_name: 'good', team_display_name: 'Good', users: [{ user_id: '2' }] }] }))
      .mockResolvedValueOnce(response({ data: [stream('2', 20)] }))

    await browser.refresh()

    expect(instance.raidCandidates).toEqual([candidate('2', 20, 'Good')])
    expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('team broken'))
    expect(browser.diagnostics).toMatchObject({
      status: 'ready',
      lastError: 'broken: team was not found or returned an invalid response',
      sourceSummary: 'broken: failed; good: 1 live',
    })
  })

  test('reports a successful refresh that finds no live channels', async () => {
    const { instance, browser } = makeInstance()
    fetchMock.mockResolvedValueOnce(response({ data: [], pagination: {} }))

    await browser.refresh()

    expect(browser.diagnostics).toMatchObject({
      status: 'no_candidates',
      lastError: '',
      sourceSummary: 'Followed: 0 live',
    })
    expect(instance.log).toHaveBeenCalledWith('warn', 'Raid browser refresh complete: 0 candidates (Followed: 0 live)')
  })

  test('reports an error when every configured source fails', async () => {
    const { browser } = makeInstance({ raidBrowserTeams: 'broken', raidBrowserIncludeFollowed: false })
    fetchMock.mockResolvedValueOnce(response({ data: [] }))

    await browser.refresh()

    expect(browser.diagnostics).toMatchObject({
      status: 'error',
      lastError: 'broken: team was not found or returned an invalid response',
      sourceSummary: 'broken: failed',
    })
  })

  test('prevents an older overlapping refresh from overwriting newer state', async () => {
    const { instance, browser } = makeInstance()
    const first = deferred<Response>()
    const second = deferred<Response>()
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const olderRefresh = browser.refresh()
    const newerRefresh = browser.refresh()
    second.resolve(response({ data: [stream('new', 20)], pagination: {} }))
    await newerRefresh
    first.resolve(response({ data: [stream('old', 10)], pagination: {} }))
    await olderRefresh

    expect(instance.raidCandidates.map((item) => item.userId)).toEqual(['new'])
  })

  test('publishes and logs wrapped encoder selection changes', () => {
    const { instance, browser } = makeInstance()
    instance.raidCandidates = [candidate('1'), candidate('2')]
    instance.raidCandidateIndex = 1

    browser.select(1)

    expect(instance.raidCandidateIndex).toBe(0)
    expect(instance.variables.updateVariables).toHaveBeenCalled()
    expect(instance.log).toHaveBeenCalledWith('debug', 'Raid browser selection: 2 -> 1 of 2 (@user1)')
  })

  test('refreshes and selects an up-next candidate from the selected channel title', async () => {
    const { instance, browser } = makeInstance()
    instance.channels = [{ username: 'self', title: 'Up next: @user1' }] as TwitchInstance['channels']
    instance.selectedChannel = 'self'
    fetchMock.mockResolvedValueOnce(response({ data: [stream('2', 20), stream('1', 10)], pagination: {} }))

    await browser.refreshAndSelectDefault()

    expect(instance.raidCandidates[instance.raidCandidateIndex]?.login).toBe('user1')
    expect(instance.log).toHaveBeenCalledWith('info', 'Selected suggested raid candidate @user1')
  })

  test('refreshes and selects candidate 1 when no up-next target is live', async () => {
    const { instance, browser } = makeInstance()
    instance.raidCandidateIndex = 1
    instance.channels = [{ username: 'self', title: 'Up next: @offline_user' }] as TwitchInstance['channels']
    instance.selectedChannel = 'self'
    fetchMock.mockResolvedValueOnce(response({ data: [stream('2', 20), stream('1', 10)], pagination: {} }))

    await browser.refreshAndSelectDefault()

    expect(instance.raidCandidateIndex).toBe(0)
  })

  test('waits for the Twitch reset header before retrying one rate-limited request', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    const removeListener = jest.spyOn(AbortSignal.prototype, 'removeEventListener')
    const { instance, browser } = makeInstance()
    fetchMock
      .mockResolvedValueOnce(response({ message: 'Too Many Requests' }, 429, { 'Ratelimit-Reset': String(Date.now() / 1000 + 1) }))
      .mockResolvedValueOnce(response({ data: [stream('1', 10)], pagination: {} }))

    const refresh = browser.refresh()
    await jest.advanceTimersByTimeAsync(1000)
    await refresh

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(instance.raidCandidates.map((item) => item.userId)).toEqual(['1'])
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    removeListener.mockRestore()
    jest.useRealTimers()
  })

  test('does not poll or request browser APIs while disabled', async () => {
    jest.useFakeTimers()
    const { browser } = makeInstance({ raidBrowserEnabled: false })

    browser.authenticationReady()
    await browser.refresh()
    jest.advanceTimersByTime(120_000)

    expect(fetchMock).not.toHaveBeenCalled()
    browser.destroy()
    jest.useRealTimers()
  })
})

describe('raid browser integration boundaries', () => {
  test('defines a Companion rotary preset with exact-label variables', () => {
    const presets = getPresets({ label: 'Twitch' } as TwitchInstance)
    const encoder = presets.raidBrowserEncoder

    expect(encoder).toMatchObject({
      type: 'button',
      options: { rotaryActions: true, stepAutoProgress: false },
      steps: [
        {
          down: [{ actionId: 'raidBrowserRefreshDefault' }],
          rotate_left: [{ actionId: 'raidBrowserPrevious' }],
          rotate_right: [{ actionId: 'raidBrowserNext' }],
        },
      ],
    })
    expect(encoder?.type === 'button' ? encoder.style.text : '').toContain('$(Twitch:raid_candidate_login)')
  })

  test('adds the follows scope only when its permission is enabled', () => {
    const disabledInstance = { config: { userReadFollows: false } } as unknown as TwitchInstance
    const enabledInstance = { config: { userReadFollows: true } } as unknown as TwitchInstance

    expect(new Auth(disabledInstance).generateScopes()).not.toContain('user:read:follows')
    expect(new Auth(enabledInstance).generateScopes()).toContain('user:read:follows')
  })

  test('Start Raid by Login expands variables before calling the existing endpoint', async () => {
    const startARaid = jest.fn()
    const parseVariablesInString = jest.fn(async () => '  @target_login  ')
    const instance = {
      channels: [],
      selectedChannel: '',
      raidCandidates: [],
      raidCandidateIndex: 0,
      API: { startARaid },
      raidBrowser: {},
      chat: {},
      log: jest.fn(),
    } as unknown as TwitchInstance
    const actions = getActions(instance)

    await actions.startRaidByLogin.callback({ options: { login: '$(custom:target)' } } as never, { parseVariablesInString } as never)

    expect(parseVariablesInString).toHaveBeenCalledWith('$(custom:target)')
    expect(startARaid).toHaveBeenCalledWith(instance, 'target_login')
  })

  test('upgrade script adds safe defaults without enabling the browser or follows scope', () => {
    const oldConfig = { channels: 'example' } as Config
    const result = getUpgrades()[0]({ currentConfig: oldConfig }, { config: oldConfig, actions: [], feedbacks: [] })

    expect(result.updatedConfig).toMatchObject({
      raidBrowserEnabled: false,
      userReadFollows: false,
      raidBrowserTeams: '',
      raidBrowserIncludeFollowed: true,
      raidBrowserRefreshSeconds: 60,
    })
  })
})
