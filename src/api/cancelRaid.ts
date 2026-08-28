import type TwitchInstance from '../index'
import { type APIError } from '../api'

export const cancelRaid = async (instance: TwitchInstance): Promise<boolean> => {
  if (!instance.auth.userID) return false

  if (!instance.auth.scopes.includes('channel:manage:raids')) {
    instance.log('warn', 'Unable to cancel a raid. Enable the Raids permission and authenticate again.')
    return false
  }

  const requestOptions = instance.API.defaultOptions()
  requestOptions.method = 'DELETE'

  try {
    const response = await fetch(`https://api.twitch.tv/helix/raids?broadcaster_id=${instance.auth.userID}`, requestOptions)
    instance.API.updateRatelimits(response.headers)

    if (response.status === 204) {
      const target = instance.raidState.pending?.targetDisplayName
      instance.raidState.clear()
      instance.log('info', target ? `Canceled the pending raid on ${target}` : 'Canceled the pending raid')
      return true
    }

    const body = (await response.json()) as APIError

    /*
     * A 404 means Twitch no longer has a cancellable countdown. Clearing the
     * local state prevents a stale Cancel button after the raid has completed
     * early through the Twitch interface.
     */
    if (response.status === 404) instance.raidState.clear()
    instance.log('warn', `Failed to Cancel Raid: ${JSON.stringify(body, null, 2)}`)
    return false
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    instance.log('warn', `Failed to Cancel Raid: ${message}`)
    return false
  }
}
