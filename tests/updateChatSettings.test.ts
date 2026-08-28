import { updateChatSettings } from '../src/api/updateChatSettings'
import type TwitchInstance from '../src/index'

const response = (): Response =>
  ({
    status: 200,
    ok: true,
    headers: new Headers(),
    json: async () => ({
      data: [
        {
          broadcaster_id: 'channel-id',
          moderator_id: 'self',
          slow_mode: false,
          slow_mode_wait_time: 30,
          follower_mode: false,
          follower_mode_duration: null,
          subscriber_mode: false,
          emote_mode: false,
          unique_chat_mode: false,
          non_moderator_chat_delay: false,
          non_moderator_chat_delay_duration: null,
        },
      ],
    }),
  }) as Response

const makeInstance = (): TwitchInstance =>
  ({
    auth: { userID: 'self', scopes: ['moderator:manage:chat_settings'] },
    channels: [
      {
        username: 'channel',
        id: 'channel-id',
        chatModes: { followers: true, followersLength: 10 },
      },
    ],
    API: {
      defaultOptions: jest.fn(() => ({ method: 'GET', headers: {} })),
      updateRatelimits: jest.fn(),
    },
    checkFeedbacks: jest.fn(),
    variables: { updateVariables: jest.fn() },
    log: jest.fn(),
  }) as unknown as TwitchInstance

describe('follower-mode chat settings', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(response())
    global.fetch = fetchMock
  })

  test('accepts numeric zero as the disable value', async () => {
    await updateChatSettings(makeInstance(), 'channel', 'follower_mode_duration', 0)

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ follower_mode: false })
  })

  test('accepts a numeric current duration as the toggle value', async () => {
    await updateChatSettings(makeInstance(), 'channel', 'follower_mode_duration', 10)

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ follower_mode: false })
  })
})
