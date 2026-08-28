import type TwitchInstance from '../index'
import { type APIError } from '../api'

type GetUsersOptions = {
  type: 'login' | 'id'
  channels: string | string[]
  throwOnError?: boolean
}

type GetUsersSuccess = {
  data: User[]
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

  let body: APIError | GetUsersSuccess
  try {
    body = (await response.json()) as APIError | GetUsersSuccess
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    instance.log('warn', `getUsers err: ${message}`)
    if (options.throwOnError) throw new GetUsersError(message, response.status)
    return []
  }

  if ('data' in body) return body.data

  const statusCode = typeof body.status === 'number' ? body.status : response.status
  const message = typeof body.message === 'string' ? body.message : `Twitch returned HTTP ${response.status}`
  instance.log('warn', `Failed to Get Users: ${JSON.stringify(body)}`)
  if (options.throwOnError) throw new GetUsersError(message, statusCode)
  return []
}
