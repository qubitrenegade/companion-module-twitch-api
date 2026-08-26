import type TwitchInstance from './index'
import type { ActionCallbacks } from './actions'
import type { FeedbackCallbacks } from './feedback'
import { combineRgb } from '@companion-module/base'

type PresetCategory = 'Raid Browser'

export interface TwitchPreset {
  category: PresetCategory
  label: string
  bank: {
    style: 'text'
    text: string
    size: 'auto' | '7' | '14' | '18' | '24' | '30' | '44'
    color: number
    bgcolor: number
  }
  actions: ActionCallbacks[]
  release_actions?: ActionCallbacks[]
  feedbacks: FeedbackCallbacks[]
}

export function getPresets(_instance: TwitchInstance): TwitchPreset[] {
  const style = {
    style: 'text' as const,
    text: '',
    size: 'auto' as const,
    color: combineRgb(255, 255, 255),
    bgcolor: combineRgb(45, 20, 70),
  }

  return [
    {
      category: 'Raid Browser',
      label: 'Previous raid candidate',
      bank: { ...style, text: 'Raid\nPrevious' },
      actions: [{ actionId: 'raidBrowserPrevious', options: { step: '1' } }],
      feedbacks: [],
    },
    {
      category: 'Raid Browser',
      label: 'Next raid candidate',
      bank: { ...style, text: 'Raid\nNext' },
      actions: [{ actionId: 'raidBrowserNext', options: { step: '1' } }],
      feedbacks: [],
    },
    {
      category: 'Raid Browser',
      label: 'Refresh raid candidates',
      bank: { ...style, text: 'Refresh\nRaids' },
      actions: [{ actionId: 'raidBrowserRefresh', options: {} }],
      feedbacks: [],
    },
    {
      category: 'Raid Browser',
      label: 'Raid selected candidate',
      bank: { ...style, text: 'Raid\n$(twitch-api:raid_candidate_display_name)' },
      actions: [{ actionId: 'raidBrowserStartSelected', options: {} }],
      feedbacks: [],
    },
  ]
}
