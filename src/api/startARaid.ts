import type TwitchInstance from '../index'
import { type APIError } from '../api'

type startARaidSuccess = {
  data: {
    created_at: string
    is_mature: boolean
  }[]
}

export const startARaid = async (instance: TwitchInstance, targetUsername: string): Promise<boolean> => {
  instance.raidState.clearError()

  if (!instance.auth.userID) {
    const message = 'Unable to start a raid because a valid broadcaster authentication is required.'
    instance.raidState.markError('start', message)
    instance.log('warn', message)
    return false
  }

  if (!instance.auth.scopes.includes('channel:manage:raids')) {
    const message = 'Unable to start a raid. Enable the Raids permission and authenticate again.'
    instance.raidState.markError('start', message)
    instance.log('warn', message)
    return false
  }

  const target = await instance.API.getUsers(instance, { type: 'login', channels: targetUsername })

  if (!target[0]?.id) {
    const message = `Unable to raid ${targetUsername}. User not found.`
    instance.raidState.markError('start', message)
    instance.log('warn', message)
    return false
  }

  const requestOptions = instance.API.defaultOptions()
  requestOptions.method = 'POST'

  try {
    const response = await fetch(`https://api.twitch.tv/helix/raids?from_broadcaster_id=${instance.auth.userID}&to_broadcaster_id=${target[0].id}`, requestOptions)
    instance.API.updateRatelimits(response.headers)
    const body = (await response.json()) as APIError | startARaidSuccess

    if (response.ok && 'data' in body && body.data[0]) {
      const displayName = target[0].display_name || target[0].login
      instance.raidState.markPending(target[0].login, displayName, body.data[0].created_at)
      instance.log('info', `Queued a raid on ${displayName}`)
      return true
    }

    const statusCode = 'status' in body && typeof body.status === 'number' ? body.status : response.status
    const message = 'message' in body && typeof body.message === 'string' ? body.message : `Twitch returned HTTP ${response.status}`
    instance.raidState.markError('start', message, statusCode)
    instance.log('warn', `Failed to Start A Raid: ${JSON.stringify(body, null, 2)}`)
    return false
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    instance.raidState.markError('start', message)
    instance.log('warn', `Failed to Start A Raid: ${message}`)
    return false
  }
}
