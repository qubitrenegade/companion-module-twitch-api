import { selectConfiguredChannel } from '../src/channelSelection'

describe('selected Twitch channel', () => {
  test('selects the first configured channel for a fresh connection', () => {
    expect(selectConfiguredChannel('', ['qbrd', 'guest'])).toBe('qbrd')
  })

  test('preserves a configured selection and falls back when it is removed', () => {
    expect(selectConfiguredChannel('guest', ['qbrd', 'guest'])).toBe('guest')
    expect(selectConfiguredChannel('removed', ['qbrd', 'guest'])).toBe('qbrd')
  })

  test('clears the selection when no channels are configured', () => {
    expect(selectConfiguredChannel('qbrd', [])).toBe('')
  })
})
