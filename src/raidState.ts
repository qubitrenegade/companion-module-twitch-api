import type TwitchInstance from './index'

export const RAID_PENDING_DURATION_MS = 90_000

export interface PendingRaid {
  targetLogin: string
  targetDisplayName: string
  createdAt: string
  expiresAt: string
}

/**
 * Twitch exposes the start of the 90-second raid countdown, but it does not
 * expose a polling endpoint for the countdown. Keeping this short-lived state
 * locally lets Companion offer a cancel control without implying that it can
 * verify whether the broadcaster clicked Raid Now in the Twitch interface.
 */
export class RaidState {
  private readonly instance: TwitchInstance
  private expiryTimer: ReturnType<typeof setTimeout> | null = null
  public pending: PendingRaid | null = null

  constructor(instance: TwitchInstance) {
    this.instance = instance
  }

  public markPending(targetLogin: string, targetDisplayName: string, createdAt: string): void {
    this.clearTimer()

    const parsedCreatedAt = Date.parse(createdAt)
    const createdAtMs = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : Date.now()
    const expiresAtMs = Math.max(createdAtMs + RAID_PENDING_DURATION_MS, Date.now())

    this.pending = {
      targetLogin,
      targetDisplayName,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    }

    const remainingMs = Math.max(expiresAtMs - Date.now(), 0)
    this.expiryTimer = setTimeout(() => this.clear(), remainingMs)
    this.publishState()
  }

  public clear(): void {
    this.clearTimer()
    this.pending = null
    this.publishState()
  }

  public destroy(): void {
    this.clearTimer()
    this.pending = null
  }

  public remainingSeconds(now = Date.now()): number {
    if (!this.pending) return 0
    return Math.max(Math.ceil((Date.parse(this.pending.expiresAt) - now) / 1000), 0)
  }

  private clearTimer(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = null
  }

  private publishState(): void {
    this.instance.variables.updateVariables()
    this.instance.checkFeedbacks('raidPending')
  }
}
