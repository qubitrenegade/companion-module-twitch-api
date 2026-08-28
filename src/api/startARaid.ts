import type TwitchInstance from '../index'
import { type APIError, parseJsonResponse } from '../api'
import { GetUsersError } from './getUsers'

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

  const targetLogin = targetUsername.trim().replace(/^@/, '')
  if (!/^[a-zA-Z0-9_]{1,25}$/.test(targetLogin)) {
    const message = 'Unable to start a raid because the target login is invalid.'
    instance.raidState.markError('start', message)
    instance.log('warn', message)
    return false
  }

  let target: Awaited<ReturnType<typeof instance.API.getUsers>>
  try {
    target = await instance.API.getUsers(instance, { type: 'login', channels: targetLogin, throwOnError: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = error instanceof GetUsersError ? error.statusCode : null
    instance.raidState.markError('start', message, statusCode)
    instance.log('warn', `Failed to resolve raid target ${targetLogin}: ${message}`)
    return false
  }

  if (!target[0]?.id) {
    const message = `Unable to raid ${targetLogin}. User not found.`
    instance.raidState.markError('start', message)
    instance.log('warn', message)
    return false
  }

  const requestOptions = instance.API.defaultOptions()
  requestOptions.method = 'POST'

  try {
    const response = await fetch(`https://api.twitch.tv/helix/raids?from_broadcaster_id=${instance.auth.userID}&to_broadcaster_id=${target[0].id}`, requestOptions)
    instance.API.updateRatelimits(response.headers)
    const body = await parseJsonResponse<APIError | startARaidSuccess>(response)

    if (response.ok && body && 'data' in body && body.data[0]) {
      const displayName = target[0].display_name || target[0].login
      instance.raidState.markPending(target[0].login, displayName, body.data[0].created_at)
      instance.log('info', `Queued a raid on ${displayName}`)
      return true
    }

    const statusCode = body && 'status' in body && typeof body.status === 'number' ? body.status : response.status
    const message = body && 'message' in body && typeof body.message === 'string' ? body.message : `Twitch returned HTTP ${response.status}`
    instance.raidState.markError('start', message, statusCode)
    instance.log('warn', `Failed to Start A Raid: ${body ? JSON.stringify(body, null, 2) : message}`)
    return false
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    instance.raidState.markError('start', message)
    instance.log('warn', `Failed to Start A Raid: ${message}`)
    return false
  }
}
