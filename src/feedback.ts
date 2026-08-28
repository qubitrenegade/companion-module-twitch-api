import type TwitchInstance from './index'
//import { options } from './utils'
import type {
  CompanionAdvancedFeedbackResult,
  CompanionFeedbackButtonStyleResult,
  CompanionFeedbackAdvancedEvent,
  CompanionFeedbackBooleanEvent,
  SomeCompanionFeedbackInputField,
} from '@companion-module/base'
import { combineRgb } from '@companion-module/base'

export interface TwitchFeedbacks {
  channelStatus: TwitchFeedback<ChannelStatusCallback>
  chatStatus: TwitchFeedback<ChatStatusCallback>
  raidCandidateAvailable: TwitchFeedback<RaidCandidateAvailableCallback>
  raidBrowserHasCandidates: TwitchFeedback<RaidBrowserHasCandidatesCallback>
  raidCandidateSource: TwitchFeedback<RaidCandidateSourceCallback>
  raidPending: TwitchFeedback<RaidPendingCallback>
  raidError: TwitchFeedback<RaidErrorCallback>

  // Index signature
  [key: string]: TwitchFeedback<any>
}

type ChatModes = 'emote' | 'followers' | 'slow' | 'sub' | 'unique'

interface ChannelStatusCallback {
  type: 'channelStatus'
  options: Readonly<{
    channel: string
  }>
}

interface ChatStatusCallback {
  type: 'chatStatus'
  options: Readonly<{
    channel: string
    mode: ChatModes
    value: string
  }>
}

interface RaidCandidateAvailableCallback {
  type: 'raidCandidateAvailable'
  options: Record<string, never>
}

interface RaidBrowserHasCandidatesCallback {
  type: 'raidBrowserHasCandidates'
  options: Record<string, never>
}

interface RaidCandidateSourceCallback {
  type: 'raidCandidateSource'
  options: Readonly<{
    sourceName: string
  }>
}

interface RaidPendingCallback {
  type: 'raidPending'
  options: Record<string, never>
}

interface RaidErrorCallback {
  type: 'raidError'
  options: Record<string, never>
}

// Callback type for Presets
export type FeedbackCallbacks = ChatStatusCallback

// Force options to have a default to prevent sending undefined values
type InputFieldWithDefault = Exclude<SomeCompanionFeedbackInputField, 'default'> & {
  default: string | number | boolean | null
}

// Twitch Boolean and Advanced feedback types
interface TwitchFeedbackBoolean<T> {
  type: 'boolean'
  name: string
  description: string
  style: Partial<CompanionFeedbackButtonStyleResult>
  options: InputFieldWithDefault[]
  callback: (feedback: Readonly<Omit<CompanionFeedbackBooleanEvent, 'options' | 'type'> & T>) => boolean
  subscribe?: (feedback: Readonly<Omit<CompanionFeedbackBooleanEvent, 'options' | 'type'> & T>) => boolean
  unsubscribe?: (feedback: Readonly<Omit<CompanionFeedbackBooleanEvent, 'options' | 'type'> & T>) => boolean
}

interface TwitchFeedbackAdvanced<T> {
  type: 'advanced'
  name: string
  description: string
  options: InputFieldWithDefault[]
  callback: (feedback: Readonly<Omit<CompanionFeedbackAdvancedEvent, 'options' | 'type'> & T>) => CompanionAdvancedFeedbackResult
  subscribe?: (feedback: Readonly<Omit<CompanionFeedbackAdvancedEvent, 'options' | 'type'> & T>) => CompanionAdvancedFeedbackResult
  unsubscribe?: (feedback: Readonly<Omit<CompanionFeedbackAdvancedEvent, 'options' | 'type'> & T>) => CompanionAdvancedFeedbackResult
}

export type TwitchFeedback<T> = TwitchFeedbackBoolean<T> | TwitchFeedbackAdvanced<T>

export function getFeedbacks(instance: TwitchInstance): TwitchFeedbacks {
  return {
    channelStatus: {
      type: 'boolean',
      name: 'Channel Status',
      description: 'Indicates if a channel is live',
      options: [
        {
          type: 'dropdown',
          label: 'Channel',
          id: 'channel',
          default: 'selected',
          choices: [{ id: 'selected', label: 'Selected' }, ...instance.channels.map((channel) => ({ id: channel.username, label: channel.displayName }))],
        },
      ],
      style: {
        color: combineRgb(0, 0, 0),
        bgcolor: combineRgb(0, 255, 0),
      },
      callback: (feedback): boolean => {
        const selection = feedback.options.channel === 'selected' ? instance.selectedChannel : feedback.options.channel
        const channel = instance.channels.find((data) => data.username === selection)

        return channel !== undefined && channel?.live !== false
      },
    },

    chatStatus: {
      type: 'boolean',
      name: 'Chat Status',
      description: 'Indicates status of different chat modes',
      options: [
        {
          type: 'dropdown',
          label: 'Channel',
          id: 'channel',
          default: 'selected',
          choices: [{ id: 'selected', label: 'Selected' }, ...instance.channels.map((channel) => ({ id: channel.username, label: channel.displayName }))],
        },
        {
          type: 'dropdown',
          label: 'Mode',
          id: 'mode',
          default: 'emote',
          choices: ['Emote', 'Followers', 'Slow', 'Sub', 'Unique'].map((mode) => ({
            id: mode.toLowerCase(),
            label: mode,
          })),
        },
        {
          type: 'textinput',
          label: 'Mode value',
          id: 'value',
          default: '',
          isVisible: (options) => {
            return !['emote', 'followers', 'sub', 'unique'].includes(options.mode as string)
          },
        },
      ],
      style: {
        color: combineRgb(0, 0, 0),
        bgcolor: combineRgb(255, 0, 0),
      },
      callback: (feedback): boolean => {
        const selection = feedback.options.channel === 'selected' ? instance.selectedChannel : feedback.options.channel
        const channel = instance.channels.find((data) => data.username === selection)

        if (channel && channel.chatModes[feedback.options.mode]) {
          if (feedback.options.mode === 'slow')
            return feedback.options.value === '' || feedback.options.value === (channel.chatModes.slowLength ? channel.chatModes.slowLength.toString() : '')
          return true
        }
        return false
      },
    },

    raidCandidateAvailable: {
      type: 'boolean',
      name: 'Raid Candidate Available',
      description: 'Indicates whether the raid browser currently has a selected candidate',
      options: [],
      style: {
        color: combineRgb(0, 0, 0),
        bgcolor: combineRgb(0, 255, 0),
      },
      callback: (): boolean => instance.raidCandidates[instance.raidCandidateIndex] !== undefined,
    },

    raidBrowserHasCandidates: {
      type: 'boolean',
      name: 'Raid Browser Has Candidates',
      description: 'Indicates whether the raid browser candidate list is non-empty',
      options: [],
      style: {
        color: combineRgb(0, 0, 0),
        bgcolor: combineRgb(0, 255, 0),
      },
      callback: (): boolean => instance.raidCandidates.length > 0,
    },

    raidCandidateSource: {
      type: 'boolean',
      name: 'Selected Raid Candidate Source',
      description: 'Indicates whether the selected raid candidate belongs to a specified team or source',
      options: [
        {
          type: 'textinput',
          label: 'Source Name',
          id: 'sourceName',
          default: '',
        },
      ],
      style: {
        color: combineRgb(0, 0, 0),
        bgcolor: combineRgb(0, 255, 0),
      },
      callback: (feedback): boolean => {
        const sourceName = instance.raidCandidates[instance.raidCandidateIndex]?.sourceName
        return sourceName !== undefined && sourceName.toLowerCase() === feedback.options.sourceName.trim().toLowerCase()
      },
    },

    raidPending: {
      type: 'boolean',
      name: 'Raid Pending',
      description: 'Indicates whether this module has started a raid countdown that may still be canceled',
      options: [],
      style: {
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(180, 0, 0),
      },
      callback: (): boolean => instance.raidState.pending !== null,
    },

    raidError: {
      type: 'boolean',
      name: 'Raid Error Active',
      description: 'Indicates whether a recent raid start or cancel error should be shown to the operator',
      options: [],
      style: {
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(255, 0, 0),
      },
      callback: (): boolean => instance.raidState.errorActive(),
    },
  }
}
