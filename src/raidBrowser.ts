import type TwitchInstance from './index'

export interface RaidCandidate {
  userId: string
  login: string
  displayName: string
  viewers: number
  category: string
  title: string
  tags: string[]
  language: string
  startedAt: string
  thumbnailUrl: string
  sourceType: 'team' | 'followed'
  sourceName: string
}

export interface TwitchStream {
  user_id: string
  user_login: string
  user_name: string
  game_name: string
  title: string
  viewer_count: number
  tags?: string[]
  language?: string
  started_at?: string
  thumbnail_url?: string
}

interface TwitchTeamUser {
  user_id: string
  user_login: string
  user_name: string
}

interface TwitchTeam {
  team_name: string
  team_display_name: string
  users: TwitchTeamUser[]
}

interface HelixResponse<T> {
  data: T[]
  pagination?: {
    cursor?: string
  }
}

interface RaidCandidateSourceResult {
  candidates: RaidCandidate[]
  summary: string
  error: string
}

export interface RaidBrowserDiagnostics {
  status: 'disabled' | 'waiting_for_authentication' | 'refreshing' | 'ready' | 'no_candidates' | 'error'
  lastRefreshAt: string
  lastError: string
  sourceSummary: string
}

export const parseRaidBrowserTeams = (value: string): string[] => {
  const seen = new Set<string>()

  return value
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export const normalizeRaidCandidates = (streams: TwitchStream[], sourceType: RaidCandidate['sourceType'], sourceName: string): RaidCandidate[] => {
  return streams
    .filter(
      (stream) =>
        typeof stream.user_id === 'string' &&
        typeof stream.user_login === 'string' &&
        typeof stream.user_name === 'string' &&
        typeof stream.game_name === 'string' &&
        typeof stream.title === 'string' &&
        typeof stream.viewer_count === 'number',
    )
    .map((stream) => ({
      userId: stream.user_id,
      login: stream.user_login,
      displayName: stream.user_name,
      viewers: stream.viewer_count,
      category: stream.game_name,
      title: stream.title,
      tags: Array.isArray(stream.tags) ? stream.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      language: typeof stream.language === 'string' ? stream.language : '',
      startedAt: typeof stream.started_at === 'string' ? stream.started_at : '',
      thumbnailUrl: typeof stream.thumbnail_url === 'string' ? stream.thumbnail_url : '',
      sourceType,
      sourceName,
    }))
}

export const parseSuggestedRaidLogin = (text: string): string => {
  const match = /\bup\s+next\b\s*(?::|-)?\s*@([a-z0-9_]{1,25})\b/i.exec(text)
  return match?.[1]?.toLowerCase() ?? ''
}

/**
 * Source arrays arrive in configured priority order. Sorting each source before
 * deduplication keeps the source boundary stable while allowing the per-source
 * ranking policy to change independently later.
 */
export const mergeRaidCandidateGroups = (groups: RaidCandidate[][], authenticatedUserId: string): RaidCandidate[] => {
  const seen = new Set<string>()
  const candidates: RaidCandidate[] = []

  for (const group of groups) {
    const sortedGroup = [...group].sort((a, b) => b.viewers - a.viewers || a.displayName.localeCompare(b.displayName))

    for (const candidate of sortedGroup) {
      if (candidate.userId === authenticatedUserId || seen.has(candidate.userId)) continue
      seen.add(candidate.userId)
      candidates.push(candidate)
    }
  }

  return candidates
}

export const selectWrappedRaidCandidateIndex = (currentIndex: number, candidateCount: number, delta: number): number => {
  if (candidateCount === 0) return 0
  return (((currentIndex + delta) % candidateCount) + candidateCount) % candidateCount
}

export const preserveRaidCandidateSelection = (previousCandidates: RaidCandidate[], previousIndex: number, candidates: RaidCandidate[]): number => {
  if (candidates.length === 0) return 0

  const selectedUserId = previousCandidates[previousIndex]?.userId
  const preservedIndex = selectedUserId ? candidates.findIndex((candidate) => candidate.userId === selectedUserId) : -1
  if (preservedIndex >= 0) return preservedIndex

  return Math.min(Math.max(previousIndex, 0), candidates.length - 1)
}

const waitUntil = async (timestampMs: number, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const delay = Math.max(timestampMs - Date.now(), 0)
  if (delay === 0) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delay)

    signal.addEventListener('abort', onAbort, { once: true })

    // AbortSignal does not replay an abort that occurs between the initial
    // check and listener registration, so close that race explicitly.
    if (signal.aborted) onAbort()
  })
}

export class RaidBrowser {
  private readonly instance: TwitchInstance
  private refreshController: AbortController | null = null
  private refreshGeneration = 0
  private refreshTimer: ReturnType<typeof setInterval> | null = null
  private followsScopeWarningKey = ''
  public diagnostics: RaidBrowserDiagnostics = {
    status: 'waiting_for_authentication',
    lastRefreshAt: '',
    lastError: '',
    sourceSummary: '',
  }

  constructor(instance: TwitchInstance) {
    this.instance = instance
  }

  public destroy(): void {
    this.stop()
  }

  public authenticationReady(): void {
    this.reconfigure(true)
  }

  public reconfigure(refreshImmediately = false): void {
    this.stop()
    this.followsScopeWarningKey = ''

    if (!this.instance.config.raidBrowserEnabled) {
      this.setDiagnostics({ status: 'disabled', lastError: '', sourceSummary: '' })
      this.replaceCandidates([])
      return
    }

    if (!this.instance.auth.valid) {
      this.setDiagnostics({ status: 'waiting_for_authentication', lastError: '', sourceSummary: '' })
      this.publishState()
      return
    }

    const refreshSeconds = Math.max(0, Number(this.instance.config.raidBrowserRefreshSeconds) || 0)
    if (refreshSeconds > 0) {
      this.refreshTimer = setInterval(() => void this.refreshFromTimer(), refreshSeconds * 1000)
    }

    if (refreshImmediately) void this.refresh()
  }

  public async refresh(): Promise<boolean> {
    if (!this.instance.config.raidBrowserEnabled) {
      this.setDiagnostics({ status: 'disabled', lastError: '', sourceSummary: '' })
      this.publishState()
      this.instance.log('debug', 'Raid browser refresh skipped because the browser is disabled')
      return false
    }
    if (!this.instance.auth.valid || !this.instance.auth.userID) {
      this.stop()
      this.setDiagnostics({ status: 'waiting_for_authentication', lastError: 'A valid Twitch authentication is required' })
      this.publishState()
      this.instance.log('warn', 'Raid browser refresh requires a valid Twitch authentication')
      return false
    }

    /*
     * Only the newest refresh owns the state. Aborting the prior request bounds
     * concurrency, while the generation check also protects against fetch mocks
     * or network stacks that complete after observing an abort.
     */
    const generation = ++this.refreshGeneration
    this.refreshController?.abort()
    const controller = new AbortController()
    this.refreshController = controller
    this.setDiagnostics({ status: 'refreshing', lastError: '' })
    this.publishState()
    this.instance.log('debug', 'Raid browser refresh started')

    try {
      const sourceResults = await this.loadCandidateGroups(controller.signal)
      if (generation !== this.refreshGeneration || controller.signal.aborted) return false

      const candidates = mergeRaidCandidateGroups(
        sourceResults.map((result) => result.candidates),
        this.instance.auth.userID,
      )
      const sourceSummary = sourceResults.map((result) => result.summary).join('; ') || 'No sources configured'
      const errors = sourceResults.map((result) => result.error).filter(Boolean)
      const allSourcesFailed = sourceResults.length > 0 && errors.length === sourceResults.length

      this.setDiagnostics({
        status: allSourcesFailed ? 'error' : candidates.length > 0 ? 'ready' : 'no_candidates',
        lastRefreshAt: new Date().toISOString(),
        lastError: errors.join('; '),
        sourceSummary,
      })
      this.replaceCandidates(candidates)

      const message = `Raid browser refresh complete: ${candidates.length} candidates (${sourceSummary})`
      this.instance.log(candidates.length > 0 ? 'info' : 'warn', message)
      return true
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error)
        this.setDiagnostics({ status: 'error', lastRefreshAt: new Date().toISOString(), lastError: message })
        this.publishState()
        this.instance.log('warn', `Raid browser refresh failed: ${message}`)
      }
      return false
    } finally {
      if (generation === this.refreshGeneration) this.refreshController = null
    }
  }

  private async refreshFromTimer(): Promise<void> {
    // A scheduled refresh is maintenance work, so it must not displace an
    // in-flight refresh. Manual actions still call refresh() directly and may
    // supersede older work because the operator's request takes priority.
    if (this.refreshController) return
    await this.refresh()
  }

  public select(delta: number): void {
    const previousIndex = this.instance.raidCandidateIndex
    this.instance.raidCandidateIndex = selectWrappedRaidCandidateIndex(this.instance.raidCandidateIndex, this.instance.raidCandidates.length, delta)
    this.publishState()
    this.logSelection(previousIndex)
  }

  public selectIndex(displayIndex: number): void {
    const previousIndex = this.instance.raidCandidateIndex
    if (this.instance.raidCandidates.length === 0) {
      this.instance.raidCandidateIndex = 0
    } else {
      this.instance.raidCandidateIndex = Math.min(Math.max(Math.trunc(displayIndex) - 1, 0), this.instance.raidCandidates.length - 1)
    }
    this.publishState()
    this.logSelection(previousIndex)
  }

  public async refreshAndSelectDefault(suggestionText = ''): Promise<void> {
    const refreshed = await this.refresh()
    if (!refreshed) return
    if (this.instance.raidCandidates.length === 0) return

    const selectedChannel = this.instance.channels.find((channel) => channel.username === this.instance.selectedChannel)
    const sourceText = suggestionText.trim() || selectedChannel?.title || ''
    const suggestedLogin = parseSuggestedRaidLogin(sourceText)
    const suggestedIndex = suggestedLogin ? this.instance.raidCandidates.findIndex((candidate) => candidate.login.toLowerCase() === suggestedLogin) : -1

    this.selectIndex(suggestedIndex >= 0 ? suggestedIndex + 1 : 1)

    if (suggestedIndex >= 0) {
      this.instance.log('info', `Selected suggested raid candidate @${suggestedLogin}`)
    } else if (suggestedLogin) {
      this.instance.log('debug', `Suggested raid candidate @${suggestedLogin} is not in the live candidate list; selected candidate 1`)
    }
  }

  private logSelection(previousIndex: number): void {
    const candidate = this.instance.raidCandidates[this.instance.raidCandidateIndex]
    const position = candidate ? this.instance.raidCandidateIndex + 1 : 0
    const previousPosition = this.instance.raidCandidates.length > 0 ? previousIndex + 1 : 0
    this.instance.log('debug', `Raid browser selection: ${previousPosition} -> ${position} of ${this.instance.raidCandidates.length}${candidate ? ` (@${candidate.login})` : ''}`)
  }

  private stop(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    this.refreshTimer = null
    this.refreshController?.abort()
    this.refreshController = null
    this.refreshGeneration++
  }

  private replaceCandidates(candidates: RaidCandidate[]): void {
    const previousCandidates = this.instance.raidCandidates
    const previousIndex = this.instance.raidCandidateIndex
    this.instance.raidCandidates = candidates
    this.instance.raidCandidateIndex = preserveRaidCandidateSelection(previousCandidates, previousIndex, candidates)
    this.publishState()
  }

  private publishState(): void {
    this.instance.variables.updateVariables()
    this.instance.checkFeedbacks('raidCandidateAvailable', 'raidBrowserHasCandidates', 'raidCandidateSource')
  }

  private setDiagnostics(update: Partial<RaidBrowserDiagnostics>): void {
    this.diagnostics = { ...this.diagnostics, ...update }
  }

  private async loadCandidateGroups(signal: AbortSignal): Promise<RaidCandidateSourceResult[]> {
    const groupPromises = parseRaidBrowserTeams(this.instance.config.raidBrowserTeams).map(async (teamName) => {
      try {
        const candidates = await this.loadTeam(teamName, signal)
        return { candidates, summary: `${teamName}: ${candidates.length} live`, error: '' }
      } catch (error) {
        if (signal.aborted) throw error
        const message = error instanceof Error ? error.message : String(error)
        this.instance.log('warn', `Unable to load raid candidates from team ${teamName}: ${message}`)
        return { candidates: [], summary: `${teamName}: failed`, error: `${teamName}: ${message}` }
      }
    })

    if (this.instance.config.raidBrowserIncludeFollowed) {
      groupPromises.push(
        (async () => {
          if (!this.instance.auth.scopes.includes('user:read:follows')) {
            const warningKey = `${this.instance.auth.userID}:${this.instance.config.raidBrowserTeams}`
            if (this.followsScopeWarningKey !== warningKey) {
              this.followsScopeWarningKey = warningKey
              this.instance.log(
                'warn',
                'Followed raid candidates are unavailable because user:read:follows is missing. Enable the Followed Live Streams permission and authenticate again.',
              )
            }
            return {
              candidates: [],
              summary: 'Followed: authentication required',
              error: 'Followed: user:read:follows permission is missing',
            }
          }

          try {
            const candidates = await this.loadFollowed(signal)
            return { candidates, summary: `Followed: ${candidates.length} live`, error: '' }
          } catch (error) {
            if (signal.aborted) throw error
            const message = error instanceof Error ? error.message : String(error)
            this.instance.log('warn', `Unable to load followed raid candidates: ${message}`)
            return { candidates: [], summary: 'Followed: failed', error: `Followed: ${message}` }
          }
        })(),
      )
    }

    return Promise.all(groupPromises)
  }

  private async loadTeam(teamName: string, signal: AbortSignal): Promise<RaidCandidate[]> {
    const teamResponse = await this.getHelix<TwitchTeam>(`teams?name=${encodeURIComponent(teamName)}`, signal)
    const team = teamResponse.data[0]
    if (!team || !Array.isArray(team.users)) throw new Error('team was not found or returned an invalid response')

    const streams: TwitchStream[] = []
    for (let offset = 0; offset < team.users.length; offset += 100) {
      const userIds = team.users.slice(offset, offset + 100).map((user) => user.user_id)
      if (userIds.length === 0) continue

      const params = new URLSearchParams({ first: '100' })
      for (const userId of userIds) params.append('user_id', userId)
      const streamResponse = await this.getHelix<TwitchStream>(`streams?${params.toString()}`, signal)
      streams.push(...streamResponse.data)
    }

    return normalizeRaidCandidates(streams, 'team', team.team_display_name || team.team_name || teamName)
  }

  private async loadFollowed(signal: AbortSignal): Promise<RaidCandidate[]> {
    const streams: TwitchStream[] = []
    let cursor = ''

    do {
      const params = new URLSearchParams({ user_id: this.instance.auth.userID, first: '100' })
      if (cursor) params.set('after', cursor)
      const response = await this.getHelix<TwitchStream>(`streams/followed?${params.toString()}`, signal)
      streams.push(...response.data)
      cursor = response.pagination?.cursor ?? ''
    } while (cursor)

    return normalizeRaidCandidates(streams, 'followed', 'Followed')
  }

  private async getHelix<T>(path: string, signal: AbortSignal, mayRetry = true): Promise<HelixResponse<T>> {
    const options = { ...this.instance.API.defaultOptions(), signal }
    const response = await fetch(`https://api.twitch.tv/helix/${path}`, options)
    this.instance.API.updateRatelimits(response.headers)

    if (response.status === 429 && mayRetry) {
      const resetHeader = response.headers.get('Ratelimit-Reset')
      const resetSeconds = resetHeader === null ? Number.NaN : Number(resetHeader)
      if (!Number.isFinite(resetSeconds)) throw new Error('Twitch rate limit response did not include a valid reset time')

      // Twitch sends an epoch timestamp. Waiting for it prevents a tight retry loop
      // that would extend the rate-limit window and waste the module's shared quota.
      // See https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits.
      await waitUntil(resetSeconds * 1000, signal)
      return this.getHelix<T>(path, signal, false)
    }

    const body = (await response.json()) as HelixResponse<T> | { message?: string }
    if (!response.ok || !('data' in body) || !Array.isArray(body.data)) {
      throw new Error('message' in body && body.message ? body.message : `Twitch returned HTTP ${response.status}`)
    }

    return body
  }
}
