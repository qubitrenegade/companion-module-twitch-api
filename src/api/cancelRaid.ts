import type TwitchInstance from '../index'
import { type APIError, parseJsonResponse } from '../api'

export const cancelRaid = async (instance: TwitchInstance): Promise<boolean> => {
  instance.raidState.clearError()

  if (!instance.auth.valid || !instance.auth.userID) {
    const message = 'Unable to cancel a raid because a valid broadcaster authentication is required.'
    instance.raidState.markError('cancel', message)
    instance.log('warn', message)
    return false
  }

  if (!instance.auth.scopes.includes('channel:manage:raids')) {
    const message = 'Unable to cancel a raid. Enable the Raids permission and authenticate again.'
    instance.raidState.markError('cancel', message)
    instance.log('warn', message)
    return false
  }

  const broadcasterID = instance.auth.userID
  const identityGeneration = instance.auth.identityGeneration
  const authenticationIsCurrent = (): boolean => instance.auth.valid && instance.auth.identityGeneration === identityGeneration && instance.auth.userID === broadcasterID

  const requestOptions = instance.API.defaultOptions()
  requestOptions.method = 'DELETE'

  try {
    const response = await fetch(`https://api.twitch.tv/helix/raids?broadcaster_id=${broadcasterID}`, requestOptions)
    if (!authenticationIsCurrent()) return false
    instance.API.updateRatelimits(response.headers)

    if (response.status === 204) {
      const target = instance.raidState.pending?.targetDisplayName
      instance.raidState.clear()
      instance.log('info', target ? `Canceled the pending raid on ${target}` : 'Canceled the pending raid')
      return true
    }

    const body = await parseJsonResponse<APIError>(response)
    if (!authenticationIsCurrent()) return false

    /*
     * A 404 means Twitch no longer has a cancellable countdown. Clearing the
     * local state prevents a stale Cancel button after the raid has completed
     * early through the Twitch interface.
     */
    if (response.status === 404) instance.raidState.clear()
    const statusCode = body && typeof body.status === 'number' ? body.status : response.status
    const message = body && typeof body.message === 'string' ? body.message : `Twitch returned HTTP ${response.status}`
    instance.raidState.markError('cancel', message, statusCode)
    instance.log('warn', `Failed to Cancel Raid: ${body ? JSON.stringify(body, null, 2) : message}`)
    return false
  } catch (error) {
    if (!authenticationIsCurrent()) return false
    const message = error instanceof Error ? error.message : String(error)
    instance.raidState.markError('cancel', message)
    instance.log('warn', `Failed to Cancel Raid: ${message}`)
    return false
  }
}
