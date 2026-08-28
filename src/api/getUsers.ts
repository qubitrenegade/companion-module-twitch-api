import type TwitchInstance from '../index'

type GetUsersOptions = {
  type: 'login' | 'id'
  channels: string | string[]
  throwOnError?: boolean
  signal?: AbortSignal
}

type User = {
  id: string
  login: string
  display_name: string
  type: 'admin' | 'global_mod' | 'staff' | ''
  broadcaster_type: 'affiliate' | 'partner' | ''
  description: string
  profile_image_url: string
  offline_image_url: string
  view_count: number // DEPRECATED
  email?: string
  created_at: string
}

export class GetUsersError extends Error {
  public readonly statusCode: number | null

  constructor(message: string, statusCode: number | null = null) {
    super(message)
    this.name = 'GetUsersError'
    this.statusCode = statusCode
  }
}

export const getUsers = async (instance: TwitchInstance, options: GetUsersOptions): Promise<User[]> => {
  const channels = Array.isArray(options.channels) ? options.channels : [options.channels]
  const parameters = new URLSearchParams()
  for (const channel of channels) parameters.append(options.type, channel)
  const requestOptions = instance.API.defaultOptions()
  requestOptions.signal = options.signal

  let response: Response
  try {
    response = await fetch(`https://api.twitch.tv/helix/users?${parameters.toString()}`, requestOptions)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    instance.log('warn', `getUsers err: ${message}`)
    if (options.throwOnError) throw new GetUsersError(message)
    return []
  }

  instance.API.updateRatelimits(response.headers)

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    const parseMessage = error instanceof Error ? error.message : String(error)
    const message = response.ok ? 'Twitch returned an invalid user lookup response' : `Twitch returned HTTP ${response.status}`
    instance.log('warn', `getUsers err: ${message}: ${parseMessage}`)
    if (options.throwOnError) throw new GetUsersError(message, response.status)
    return []
  }

  if (typeof body !== 'object' || body === null) {
    const message = response.ok ? 'Twitch returned an invalid user lookup response' : `Twitch returned HTTP ${response.status}`
    instance.log('warn', `getUsers err: ${message}`)
    if (options.throwOnError) throw new GetUsersError(message, response.status)
    return []
  }

  if (response.ok && 'data' in body && Array.isArray(body.data)) return body.data as User[]

  const statusCode = 'status' in body && typeof body.status === 'number' ? body.status : response.status
  const message =
    'message' in body && typeof body.message === 'string'
      ? body.message
      : response.ok
        ? 'Twitch returned an invalid user lookup response'
        : `Twitch returned HTTP ${response.status}`
  instance.log('warn', `Failed to Get Users: ${JSON.stringify(body)}`)
  if (options.throwOnError) throw new GetUsersError(message, statusCode)
  return []
}
