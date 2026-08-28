import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

interface ExampleLayout {
  name: string
  coordinates: string[]
  lcdRow: string
  encoderRow: string
  encoderColumns: string[]
}

const layouts: ExampleLayout[] = [
  {
    name: 'streamdeck-plus-raid-browser',
    coordinates: ['0/0', '1/0', '1/1', '2/0', '2/1', '2/2', '2/3', '3/0', '3/1', '3/2', '3/3'],
    lcdRow: '2',
    encoderRow: '3',
    encoderColumns: ['0', '1', '2', '3'],
  },
  {
    name: 'streamdeck-plus-xl-raid-browser',
    coordinates: ['0/0', '1/0', '1/1', '4/3', '4/5', '4/6', '4/8', '5/3', '5/5', '5/6', '5/8'],
    lcdRow: '4',
    encoderRow: '5',
    encoderColumns: ['3', '5', '6', '8'],
  },
]

function collectDefinitionIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectDefinitionIds)
  if (!value || typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  const ownId = typeof record.definitionId === 'string' ? [record.definitionId] : []
  return [...ownId, ...Object.values(record).flatMap(collectDefinitionIds)]
}

describe.each(layouts)('$name example config', (layout) => {
  const assetPath = join(__dirname, '..', 'companion', 'assets', `${layout.name}.companionconfig`)
  const config = JSON.parse(readFileSync(assetPath, 'utf8')) as ExampleConfig
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

  test('uses the intended coordinates', () => {
    const coordinates = Object.entries(config.page.controls).flatMap(([row, columns]) => Object.keys(columns).map((column) => `${row}/${column}`))
    expect(coordinates).toEqual(layout.coordinates)
  })

  test('provides dedicated raid and browse buttons', () => {
    expect(collectDefinitionIds(config.page.controls['0']['0'])).toEqual(expect.arrayContaining(['raidBrowserStartSelected', 'raidCancel']))
    expect(collectDefinitionIds(config.page.controls['1']['0'])).toContain('raidBrowserPrevious')
    expect(collectDefinitionIds(config.page.controls['1']['1'])).toContain('raidBrowserNext')
  })

  test('cancels from every assigned encoder and browses from the rightmost encoder', () => {
    for (const column of layout.encoderColumns) {
      const down = config.page.controls[layout.encoderRow][column].steps['0'].action_sets.down
      expect(collectDefinitionIds(down)).toContain('raidCancel')
    }

    const rightmostColumn = layout.encoderColumns.at(-1) as string
    const rightmostActions = config.page.controls[layout.encoderRow][rightmostColumn].steps['0'].action_sets
    expect(collectDefinitionIds(rightmostActions.rotate_left)).toContain('raidBrowserPrevious')
    expect(collectDefinitionIds(rightmostActions.rotate_right)).toContain('raidBrowserNext')
    expect(collectDefinitionIds(rightmostActions.down)).toContain('raidBrowserRefreshDefault')
  })

  test('shows metadata and splits raid errors at a word boundary', () => {
    const lcdContent = JSON.stringify(config.page.controls[layout.lcdRow])
    expect(lcdContent).toContain('raid_candidate_display_name')
    expect(lcdContent).toContain('raid_candidate_viewers_formatted')
    expect(lcdContent).toContain('raid_candidate_tags')
    expect(lcdContent).toContain('raid_candidate_title')
    expect(lcdContent).toContain('raid_error_message')
    expect(lcdContent).toContain("lastIndexOf(message, ' ', 52)")
    expect(lcdContent).toContain('substr(message, 0, splitAt)')
    expect(lcdContent).toContain('trim(substr(message, splitAt, 112))')
  })
})
