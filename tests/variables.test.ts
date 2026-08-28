import type TwitchInstance from '../src/index'
import type { RaidCandidate } from '../src/raidBrowser'
import { Variables } from '../src/variables'

describe('raid variable contract', () => {
  afterEach(() => jest.restoreAllMocks())

  test('defines and publishes candidate metadata and pending-raid state', () => {
    const setVariableDefinitions = jest.fn()
    const setVariableValues = jest.fn()
    const candidate: RaidCandidate = {
      userId: 'target-id',
      login: 'target',
      displayName: 'Target',
      viewers: 1234,
      category: 'Music',
      title: 'Friday session',
      tags: ['Drum and Bass', 'English'],
      language: 'en',
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      thumbnailUrl: 'https://example.com/{width}x{height}.jpg',
      sourceType: 'team',
      sourceName: 'Team A',
    }
    const instance = {
      API: {
        ratelimitLimit: '800',
        ratelimitRemaining: '799',
        requestsPerMin: 1,
        clip: { id: '', url: '', edit_url: '' },
      },
      auth: { userID: 'self' },
      channels: [],
      selectedChannel: '',
      raidCandidates: [candidate],
      raidCandidateIndex: 0,
      raidBrowser: {
        diagnostics: { status: 'ready', lastRefreshAt: 'now', lastError: '', sourceSummary: 'Team A: 1 live' },
      },
      raidState: {
        pending: {
          targetLogin: 'target',
          targetDisplayName: 'Target',
          createdAt: '2026-08-28T12:00:00.000Z',
          expiresAt: '2026-08-28T12:01:30.000Z',
        },
        remainingSeconds: jest.fn(() => 42),
        lastError: {
          operation: 'start',
          statusCode: 429,
          message: 'Too Many Requests',
          occurredAt: '2026-08-28T12:00:10.000Z',
          displayUntil: '2026-08-28T12:00:25.000Z',
        },
        errorActive: jest.fn(() => true),
      },
      setVariableDefinitions,
      setVariableValues,
    } as unknown as TwitchInstance
    const variables = new Variables(instance)
    const initialCandidates = instance.raidCandidates
    const stringify = jest.spyOn(JSON, 'stringify')

    variables.updateDefinitions()
    variables.updateVariables()

    const definitions = setVariableDefinitions.mock.calls[0][0] as { variableId: string }[]
    expect(definitions.map((definition) => definition.variableId)).toEqual(
      expect.arrayContaining([
        'raid_candidate_tags',
        'raid_candidate_started_at',
        'raid_candidate_uptime',
        'raid_candidate_thumbnail_url',
        'raid_pending',
        'raid_pending_seconds_remaining',
        'raid_error_active',
        'raid_error_operation',
        'raid_error_status',
        'raid_error_message',
      ]),
    )
    expect(setVariableValues).toHaveBeenCalledWith(
      expect.objectContaining({
        raid_candidate_tags: 'Drum and Bass, English',
        raid_candidate_viewers_formatted: '1,234',
        raid_candidate_thumbnail_url: 'https://example.com/{width}x{height}.jpg',
        raid_pending: 'true',
        raid_pending_target_login: 'target',
        raid_pending_seconds_remaining: '42',
        raid_error_active: 'true',
        raid_error_operation: 'start',
        raid_error_status: '429',
        raid_error_message: 'Too Many Requests',
      }),
    )

    if (instance.raidState.lastError) instance.raidState.lastError.statusCode = null
    variables.updateVariables()

    expect(setVariableValues).toHaveBeenLastCalledWith(expect.objectContaining({ raid_error_status: '' }))
    expect(stringify.mock.calls.filter(([value]) => value === initialCandidates)).toHaveLength(1)

    const replacementCandidates = [...initialCandidates]
    instance.raidCandidates = replacementCandidates
    variables.updateVariables()

    expect(stringify.mock.calls.filter(([value]) => value === replacementCandidates)).toHaveLength(1)
  })
})
