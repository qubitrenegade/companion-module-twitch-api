import type TwitchInstance from './index'
import { combineRgb, type CompanionButtonStyleProps, type CompanionPresetDefinitions } from '@companion-module/base'

const CATEGORY = 'Raid Browser'
const TWITCH_PURPLE = combineRgb(100, 65, 165)
const ACTION_RED = combineRgb(180, 0, 0)
const WHITE = combineRgb(255, 255, 255)

const style = (text: string, bgcolor = TWITCH_PURPLE): CompanionButtonStyleProps => ({
  text,
  size: 'auto',
  color: WHITE,
  bgcolor,
})

export function getPresets(instance: TwitchInstance): CompanionPresetDefinitions {
  const variable = (name: string): string => `$(${instance.label}:${name})`

  return {
    raidBrowserEncoder: {
      type: 'button',
      category: CATEGORY,
      name: 'Browse raid candidates with a rotary encoder',
      style: style(`${variable('raid_candidate_index')}/${variable('raid_candidate_count')}\n@${variable('raid_candidate_login')}`),
      options: {
        rotaryActions: true,
        stepAutoProgress: false,
      },
      steps: [
        {
          down: [{ actionId: 'raidBrowserRefreshDefault', options: { suggestionText: '' } }],
          up: [],
          rotate_left: [{ actionId: 'raidBrowserPrevious', options: { step: '1' } }],
          rotate_right: [{ actionId: 'raidBrowserNext', options: { step: '1' } }],
        },
      ],
      feedbacks: [],
    },
    raidBrowserPrevious: {
      type: 'button',
      category: CATEGORY,
      name: 'Select previous raid candidate',
      style: style('Raid\nPrevious'),
      steps: [{ down: [{ actionId: 'raidBrowserPrevious', options: { step: '1' } }], up: [] }],
      feedbacks: [],
    },
    raidBrowserNext: {
      type: 'button',
      category: CATEGORY,
      name: 'Select next raid candidate',
      style: style('Raid\nNext'),
      steps: [{ down: [{ actionId: 'raidBrowserNext', options: { step: '1' } }], up: [] }],
      feedbacks: [],
    },
    raidBrowserRefresh: {
      type: 'button',
      category: CATEGORY,
      name: 'Refresh raid candidates',
      style: style('Refresh\nRaids'),
      steps: [{ down: [{ actionId: 'raidBrowserRefresh', options: {} }], up: [] }],
      feedbacks: [],
    },
    raidBrowserRefreshDefault: {
      type: 'button',
      category: CATEGORY,
      name: 'Refresh and select default raid candidate',
      style: style('Default\nRaid Target'),
      steps: [{ down: [{ actionId: 'raidBrowserRefreshDefault', options: { suggestionText: '' } }], up: [] }],
      feedbacks: [],
    },
    raidBrowserStart: {
      type: 'button',
      category: CATEGORY,
      name: 'Start raid to selected candidate',
      style: style(`Raid\n@${variable('raid_candidate_login')}`),
      steps: [{ down: [{ actionId: 'raidBrowserStartSelected', options: {} }], up: [] }],
      feedbacks: [
        {
          feedbackId: 'raidPending',
          options: {},
          style: { bgcolor: ACTION_RED, color: WHITE },
        },
        {
          feedbackId: 'raidError',
          options: {},
          style: { bgcolor: combineRgb(255, 0, 0), color: WHITE },
        },
      ],
    },
    raidCancel: {
      type: 'button',
      category: CATEGORY,
      name: 'Cancel pending raid',
      style: style(`Cancel Raid\n${variable('raid_pending_seconds_remaining')}s`, ACTION_RED),
      steps: [{ down: [{ actionId: 'raidCancel', options: {} }], up: [] }],
      feedbacks: [],
    },
    raidCandidateDetails: {
      type: 'button',
      category: CATEGORY,
      name: 'Selected raid candidate details',
      style: style(
        `${variable('raid_candidate_index')}/${variable('raid_candidate_count')} ${variable('raid_candidate_display_name')}\n${variable('raid_candidate_viewers_formatted')} viewers`,
      ),
      steps: [{ down: [], up: [] }],
      feedbacks: [],
    },
  }
}
