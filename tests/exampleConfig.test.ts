import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

interface ExampleControl {
  steps: Record<
    string,
    {
      action_sets: {
        down: unknown[]
        up: unknown[]
        rotate_left?: unknown[]
        rotate_right?: unknown[]
      }
    }
  >
}

interface ExampleConfig {
  version: number
  type: string
  page: {
    controls: Record<string, Record<string, ExampleControl>>
  }
  instances: Record<string, Record<string, unknown>>
}

const examplePath = join(__dirname, '..', 'companion', 'assets', 'streamdeck-plus-raid-browser.companionconfig')

function collectDefinitionIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectDefinitionIds)
  if (!value || typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  const ownId = typeof record.definitionId === 'string' ? [record.definitionId] : []
  return [...ownId, ...Object.values(record).flatMap(collectDefinitionIds)]
}

describe('Stream Deck + example config', () => {
  const config = JSON.parse(gunzipSync(readFileSync(examplePath)).toString('utf8')) as ExampleConfig
  const serialized = JSON.stringify(config)

  test('is a sanitized Companion 5 page export', () => {
    expect(config).toMatchObject({ version: 12, type: 'page' })
    expect(Object.keys(config.instances)).toHaveLength(1)

    const [connection] = Object.values(config.instances)
    expect(connection).toMatchObject({ label: 'Twitch', moduleId: 'twitch-api', moduleVersionId: '4.3.0' })
    expect(connection).not.toHaveProperty('config')
    expect(connection).not.toHaveProperty('secrets')

    for (const privateMarker of ['oauth', 'access_token', 'refresh_token', '127.0.0.1', 'qbrd', 'ubb', 'junglists', 'drumandbass', 'AD4MA61912ZGI3', '$(custom:']) {
      expect(serialized.toLowerCase()).not.toContain(privateMarker.toLowerCase())
    }
  })

  test('uses the intended Stream Deck + coordinates', () => {
    const coordinates = Object.entries(config.page.controls).flatMap(([row, columns]) => Object.keys(columns).map((column) => `${row}/${column}`))

    expect(coordinates).toEqual(['0/0', '1/0', '1/1', '2/0', '2/1', '2/2', '2/3', '3/0', '3/1', '3/2', '3/3'])
  })

  test('provides dedicated raid and browse buttons', () => {
    expect(collectDefinitionIds(config.page.controls['0']['0'])).toEqual(expect.arrayContaining(['raidBrowserStartSelected', 'raidCancel']))
    expect(collectDefinitionIds(config.page.controls['1']['0'])).toContain('raidBrowserPrevious')
    expect(collectDefinitionIds(config.page.controls['1']['1'])).toContain('raidBrowserNext')
  })

  test('cancels from every encoder and browses from the rightmost encoder', () => {
    for (const column of ['0', '1', '2', '3']) {
      const down = config.page.controls['3'][column].steps['0'].action_sets.down
      expect(collectDefinitionIds(down)).toContain('raidCancel')
    }

    const rightmostActions = config.page.controls['3']['3'].steps['0'].action_sets
    expect(collectDefinitionIds(rightmostActions.rotate_left)).toContain('raidBrowserPrevious')
    expect(collectDefinitionIds(rightmostActions.rotate_right)).toContain('raidBrowserNext')
    expect(collectDefinitionIds(rightmostActions.down)).toContain('raidBrowserRefreshDefault')
  })

  test('shows candidate metadata and splits raid errors across LCD segments', () => {
    const lcdContent = JSON.stringify(config.page.controls['2'])
    expect(lcdContent).toContain('raid_candidate_display_name')
    expect(lcdContent).toContain('raid_candidate_viewers_formatted')
    expect(lcdContent).toContain('raid_candidate_tags')
    expect(lcdContent).toContain('raid_candidate_title')
    expect(lcdContent).toContain('raid_error_message')
    expect(lcdContent).toContain('substr(message, 0, 52)')
    expect(lcdContent).toContain('substr(message, 52, 112)')
  })
})
