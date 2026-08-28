import type VMixInstance from './'
import { formatNumber, formatTime } from './utils'

interface InstanceVariableDefinition {
  name: string
  variableId: string
  type?: string
}

interface InstanceVariableValue {
  [key: string]: string | number | undefined
}

export class Variables {
  private readonly instance: VMixInstance
  //private currentDefinitions: Set<InstanceVariableDefinition> = new Set()

  constructor(instance: VMixInstance) {
    this.instance = instance
  }

  /**
   * @param variables Object of variable names and their values
   * @description Updates or removes variable for current instance
   */
  public readonly set = (variables: InstanceVariableValue): void => {
    const newVariables: { [variableId: string]: string | undefined } = {}

    for (const name in variables) {
      newVariables[name] = variables[name]?.toString()
    }

    this.instance.setVariableValues(newVariables)
  }

  /**
   * @description Sets variable definitions
   */
  public readonly updateDefinitions = (): void => {
    const variables: Set<InstanceVariableDefinition> = new Set([])

    variables.add({ name: `Ratelimit Limit`, variableId: `ratelimit_limit` })
    variables.add({ name: `Ratelimit Remaining`, variableId: `ratelimit_remaining` })
    variables.add({ name: `Requests per Min`, variableId: `requests_per_min` })

    variables.add({ name: 'Raid Candidate Count', variableId: 'raid_candidate_count' })
    variables.add({ name: 'Raid Candidate Index', variableId: 'raid_candidate_index' })
    variables.add({ name: 'Raid Candidate Login', variableId: 'raid_candidate_login' })
    variables.add({ name: 'Raid Candidate Display Name', variableId: 'raid_candidate_display_name' })
    variables.add({ name: 'Raid Candidate User ID', variableId: 'raid_candidate_user_id' })
    variables.add({ name: 'Raid Candidate Viewers', variableId: 'raid_candidate_viewers' })
    variables.add({ name: 'Raid Candidate Viewers (formatted)', variableId: 'raid_candidate_viewers_formatted' })
    variables.add({ name: 'Raid Candidate Category', variableId: 'raid_candidate_category' })
    variables.add({ name: 'Raid Candidate Title', variableId: 'raid_candidate_title' })
    variables.add({ name: 'Raid Candidate Tags', variableId: 'raid_candidate_tags' })
    variables.add({ name: 'Raid Candidate Tags JSON', variableId: 'raid_candidate_tags_json' })
    variables.add({ name: 'Raid Candidate Language', variableId: 'raid_candidate_language' })
    variables.add({ name: 'Raid Candidate Started At', variableId: 'raid_candidate_started_at' })
    variables.add({ name: 'Raid Candidate Uptime', variableId: 'raid_candidate_uptime' })
    variables.add({ name: 'Raid Candidate Thumbnail URL', variableId: 'raid_candidate_thumbnail_url' })
    variables.add({ name: 'Raid Candidate Source Type', variableId: 'raid_candidate_source_type' })
    variables.add({ name: 'Raid Candidate Source Name', variableId: 'raid_candidate_source_name' })
    variables.add({ name: 'Raid Candidate Available', variableId: 'raid_candidate_available' })
    variables.add({ name: 'Raid Candidates JSON', variableId: 'raid_candidates_json' })
    variables.add({ name: 'Raid Browser Status', variableId: 'raid_browser_status' })
    variables.add({ name: 'Raid Browser Last Refresh', variableId: 'raid_browser_last_refresh' })
    variables.add({ name: 'Raid Browser Last Error', variableId: 'raid_browser_last_error' })
    variables.add({ name: 'Raid Browser Source Summary', variableId: 'raid_browser_source_summary' })
    variables.add({ name: 'Raid Pending', variableId: 'raid_pending' })
    variables.add({ name: 'Raid Pending Target Login', variableId: 'raid_pending_target_login' })
    variables.add({ name: 'Raid Pending Target Display Name', variableId: 'raid_pending_target_display_name' })
    variables.add({ name: 'Raid Pending Created At', variableId: 'raid_pending_created_at' })
    variables.add({ name: 'Raid Pending Expires At', variableId: 'raid_pending_expires_at' })
    variables.add({ name: 'Raid Pending Seconds Remaining', variableId: 'raid_pending_seconds_remaining' })
    variables.add({ name: 'Raid Error Active', variableId: 'raid_error_active' })
    variables.add({ name: 'Raid Error Operation', variableId: 'raid_error_operation' })
    variables.add({ name: 'Raid Error HTTP Status', variableId: 'raid_error_status' })
    variables.add({ name: 'Raid Error Message', variableId: 'raid_error_message' })
    variables.add({ name: 'Raid Error Occurred At', variableId: 'raid_error_occurred_at' })

    variables.add({ name: `Selected Channel`, variableId: `selected` })
    variables.add({ name: `Selected Channel Live`, variableId: `selected_live` })
    variables.add({ name: `Selected Channel Uptime`, variableId: `selected_uptime` })
    variables.add({ name: `Selected Channel Viewers`, variableId: `selected_viewers` })
    variables.add({ name: `Selected Channel Viewers (formatted)`, variableId: `selected_viewers_formatted` })
    variables.add({ name: `Selected Channel Chatters`, variableId: `selected_chatters` })
    variables.add({ name: `Selected Channel Chatters (formatted)`, variableId: `selected_chatters_formatted` })
    variables.add({ name: `Selected Channel Category`, variableId: `selected_category` })
    variables.add({ name: `Selected Channel Category ID`, variableId: `selected_category_id` })
    variables.add({ name: `Selected Channel Followers`, variableId: `selected_followers` })
    variables.add({ name: `Selected Channel Followers (formatted)`, variableId: `selected_followers_formatted` })
    variables.add({ name: `Selected Channel Title`, variableId: `selected_title` })
    variables.add({ name: `Selected Channel Chat 1m Activity`, variableId: `selected_chat_activity_1m` })
    variables.add({ name: `Selected Channel Chat 5m Activity`, variableId: `selected_chat_activity_5m` })
    variables.add({ name: `Selected Channel Chat 15m Activity`, variableId: `selected_chat_activity_15m` })
    variables.add({ name: `Selected Channel Chat 60m Activity`, variableId: `selected_chat_activity_60m` })
    variables.add({ name: `Selected Channel Chat Total Activity`, variableId: `selected_chat_activity_total` })
    variables.add({ name: `Selected Channel Chat Emote Only`, variableId: `selected_chat_mode_emote` })
    variables.add({ name: `Selected Channel Chat Followers Only`, variableId: `selected_chat_mode_followers` })
    variables.add({ name: `Selected Channel Chat Followers Length`, variableId: `selected_chat_mode_followers_length` })
    variables.add({ name: `Selected Channel Chat Slow Mode`, variableId: `selected_chat_mode_slow` })
    variables.add({ name: `Selected Channel Chat Slow Length`, variableId: `selected_chat_mode_slow_length` })
    variables.add({ name: `Selected Channel Chat Sub Only`, variableId: `selected_chat_mode_sub` })
    variables.add({ name: `Selected Channel Chat Unique Mode`, variableId: `selected_chat_mode_unique` })

    this.instance.channels.forEach((channel) => {
      variables.add({ name: `${channel.displayName} Channel Live`, variableId: `${channel.username}_live` })
      variables.add({ name: `${channel.displayName} Channel Uptime`, variableId: `${channel.username}_uptime` })
      variables.add({ name: `${channel.displayName} Viewers`, variableId: `${channel.username}_viewers` })
      variables.add({ name: `${channel.displayName} Viewers (formatted)`, variableId: `${channel.username}_viewers_formatted` })
      variables.add({ name: `${channel.displayName} Chatters`, variableId: `${channel.username}_chatters` })
      variables.add({ name: `${channel.displayName} Chatters (formatted)`, variableId: `${channel.username}_chatters_formatted` })
      variables.add({ name: `${channel.displayName} Category`, variableId: `${channel.username}_category` })
      variables.add({ name: `${channel.displayName} Category ID`, variableId: `${channel.username}_category_id` })
      variables.add({ name: `${channel.displayName} Followers`, variableId: `${channel.username}_followers` })
      variables.add({ name: `${channel.displayName} Followers (formatted)`, variableId: `${channel.username}_followers_formatted` })
      variables.add({ name: `${channel.displayName} Title`, variableId: `${channel.username}_title` })
      variables.add({ name: `${channel.displayName} Chat 1m Activity`, variableId: `${channel.username}_chat_activity_1m` })
      variables.add({ name: `${channel.displayName} Chat 5m Activity`, variableId: `${channel.username}_chat_activity_5m` })
      variables.add({ name: `${channel.displayName} Chat 15m Activity`, variableId: `${channel.username}_chat_activity_15m` })
      variables.add({ name: `${channel.displayName} Chat 60m Activity`, variableId: `${channel.username}_chat_activity_60m` })
      variables.add({ name: `${channel.displayName} Chat Total Activity`, variableId: `${channel.username}_chat_activity_total` })
      variables.add({ name: `${channel.displayName} Channel Chat Emote Only`, variableId: `${channel.username}_chat_mode_emote` })
      variables.add({ name: `${channel.displayName} Channel Chat Followers Only`, variableId: `${channel.username}_chat_mode_followers` })
      variables.add({ name: `${channel.displayName} Channel Chat Followers Length`, variableId: `${channel.username}_chat_mode_followers_length` })
      variables.add({ name: `${channel.displayName} Channel Chat Slow Mode`, variableId: `${channel.username}_chat_mode_slow` })
      variables.add({ name: `${channel.displayName} Channel Chat Slow Length`, variableId: `${channel.username}_chat_mode_slow_length` })
      variables.add({ name: `${channel.displayName} Channel Chat Sub Only`, variableId: `${channel.username}_chat_mode_sub` })
      variables.add({ name: `${channel.displayName} Channel Chat Unique Mode`, variableId: `${channel.username}_chat_mode_unique` })
    })

    variables.add({ name: 'Clip ID', variableId: `clip_id` })
    variables.add({ name: 'Clip URL', variableId: `clip_url` })
    variables.add({ name: 'Clip Edit URL', variableId: `clip_edit_url` })

    variables.add({ name: 'Ad Next', variableId: 'ad_next' })
    variables.add({ name: 'Ad Last', variableId: 'ad_last' })
    variables.add({ name: 'Ad Duration', variableId: 'ad_duration' })
    variables.add({ name: 'Ad Preroll Free Time', variableId: 'ad_preroll_free_time' })
    variables.add({ name: 'Ad Snooze Count', variableId: 'ad_snooze_count' })
    variables.add({ name: 'Ad Snooze Refresh', variableId: 'ad_snooze_refresh' })

    this.instance.setVariableDefinitions([...variables])
  }

  /**
   * @description Update variables
   */
  public readonly updateVariables = (): void => {
    const newVariables: InstanceVariableValue = {}

    newVariables.ratelimit_limit = this.instance.API.ratelimitLimit
    newVariables.ratelimit_remaining = this.instance.API.ratelimitRemaining
    newVariables.requests_per_min = this.instance.API.requestsPerMin

    const raidCandidate = this.instance.raidCandidates[this.instance.raidCandidateIndex]
    newVariables.raid_candidate_count = this.instance.raidCandidates.length
    newVariables.raid_candidate_index = raidCandidate ? this.instance.raidCandidateIndex + 1 : 0
    newVariables.raid_candidate_login = raidCandidate?.login ?? ''
    newVariables.raid_candidate_display_name = raidCandidate?.displayName ?? ''
    newVariables.raid_candidate_user_id = raidCandidate?.userId ?? ''
    newVariables.raid_candidate_viewers = raidCandidate?.viewers ?? 0
    newVariables.raid_candidate_viewers_formatted = formatNumber(raidCandidate?.viewers ?? 0)
    newVariables.raid_candidate_category = raidCandidate?.category ?? ''
    newVariables.raid_candidate_title = raidCandidate?.title ?? ''
    newVariables.raid_candidate_tags = raidCandidate?.tags.join(', ') ?? ''
    newVariables.raid_candidate_tags_json = JSON.stringify(raidCandidate?.tags ?? [])
    newVariables.raid_candidate_language = raidCandidate?.language ?? ''
    newVariables.raid_candidate_started_at = raidCandidate?.startedAt ?? ''
    const raidCandidateStartedAt = Date.parse(raidCandidate?.startedAt ?? '')
    newVariables.raid_candidate_uptime = Number.isFinite(raidCandidateStartedAt) ? formatTime(Date.now() - raidCandidateStartedAt, 'ms', 'hh:mm:ss') : ''
    newVariables.raid_candidate_thumbnail_url = raidCandidate?.thumbnailUrl ?? ''
    newVariables.raid_candidate_source_type = raidCandidate?.sourceType ?? ''
    newVariables.raid_candidate_source_name = raidCandidate?.sourceName ?? ''
    newVariables.raid_candidate_available = Boolean(raidCandidate).toString()
    newVariables.raid_candidates_json = JSON.stringify(this.instance.raidCandidates)
    newVariables.raid_browser_status = this.instance.raidBrowser.diagnostics.status
    newVariables.raid_browser_last_refresh = this.instance.raidBrowser.diagnostics.lastRefreshAt
    newVariables.raid_browser_last_error = this.instance.raidBrowser.diagnostics.lastError
    newVariables.raid_browser_source_summary = this.instance.raidBrowser.diagnostics.sourceSummary
    newVariables.raid_pending = Boolean(this.instance.raidState.pending).toString()
    newVariables.raid_pending_target_login = this.instance.raidState.pending?.targetLogin ?? ''
    newVariables.raid_pending_target_display_name = this.instance.raidState.pending?.targetDisplayName ?? ''
    newVariables.raid_pending_created_at = this.instance.raidState.pending?.createdAt ?? ''
    newVariables.raid_pending_expires_at = this.instance.raidState.pending?.expiresAt ?? ''
    newVariables.raid_pending_seconds_remaining = this.instance.raidState.remainingSeconds()
    newVariables.raid_error_active = this.instance.raidState.errorActive().toString()
    newVariables.raid_error_operation = this.instance.raidState.lastError?.operation ?? ''
    newVariables.raid_error_status = this.instance.raidState.lastError?.statusCode || ''
    newVariables.raid_error_message = this.instance.raidState.lastError?.message ?? ''
    newVariables.raid_error_occurred_at = this.instance.raidState.lastError?.occurredAt ?? ''

    const selectedChannel = this.instance.channels.find((channel) => channel.username === this.instance.selectedChannel)
    newVariables[`selected`] = selectedChannel ? selectedChannel.displayName : ''

    this.instance.channels.forEach((channel) => {
      let activity1m = 0
      let activity5m = 0
      let activity15m = 0
      let activity60m = 0

      channel.chatActivity.recent.forEach((minute, index) => {
        if (index === 0) activity1m = minute
        if (index < 5) activity5m = activity5m + minute
        if (index < 15) activity15m = activity15m + minute
        activity60m = activity60m + minute
      })

      const calcUptime = (): string => {
        return channel.live === false ? '' : formatTime(new Date().getTime() - channel.live.getTime(), 'ms', 'hh:mm:ss')
      }

      newVariables[`${channel.username}_live`] = (channel.live !== false).toString()
      newVariables[`${channel.username}_uptime`] = calcUptime()
      newVariables[`${channel.username}_viewers`] = channel.viewers
      newVariables[`${channel.username}_viewers_formatted`] = formatNumber(channel.viewers)
      newVariables[`${channel.username}_chatters`] = channel.chattersTotal
      newVariables[`${channel.username}_chatters_formatted`] = formatNumber(channel.chattersTotal)
      newVariables[`${channel.username}_category`] = channel.categoryName
      newVariables[`${channel.username}_category_id`] = channel.categoryID
      newVariables[`${channel.username}_followers`] = channel.followersTotal
      newVariables[`${channel.username}_followers_formatted`] = formatNumber(channel.followersTotal)
      newVariables[`${channel.username}_title`] = channel.title
      newVariables[`${channel.username}_chat_activity_1m`] = activity1m
      newVariables[`${channel.username}_chat_activity_5m`] = activity5m
      newVariables[`${channel.username}_chat_activity_15m`] = activity15m
      newVariables[`${channel.username}_chat_activity_60m`] = activity60m
      newVariables[`${channel.username}_chat_activity_total`] = channel.chatActivity.total
      newVariables[`${channel.username}_chat_mode_emote`] = channel.chatModes.emote.toString()
      newVariables[`${channel.username}_chat_mode_followers`] = channel.chatModes.followers.toString()
      newVariables[`${channel.username}_chat_mode_followers_length`] = channel.chatModes.followersLength ? channel.chatModes.followersLength.toString() : '0'
      newVariables[`${channel.username}_chat_mode_slow`] = channel.chatModes.slow.toString()
      newVariables[`${channel.username}_chat_mode_slow_length`] = channel.chatModes.slowLength ? channel.chatModes.slowLength.toString() : '0'
      newVariables[`${channel.username}_chat_mode_sub`] = channel.chatModes.sub.toString()
      newVariables[`${channel.username}_chat_mode_unique`] = channel.chatModes.unique.toString()

      if (channel.username === this.instance.selectedChannel) {
        newVariables[`selected_live`] = (channel.live !== false).toString()
        newVariables[`selected_uptime`] = calcUptime()
        newVariables[`selected_viewers`] = channel.viewers
        newVariables[`selected_viewers_formatted`] = formatNumber(channel.viewers)
        newVariables[`selected_chatters`] = channel.chattersTotal
        newVariables[`selected_chatters_formatted`] = formatNumber(channel.chattersTotal)
        newVariables[`selected_category`] = channel.categoryName
        newVariables[`selected_category_id`] = channel.categoryID
        newVariables[`selected_followers`] = channel.followersTotal
        newVariables[`selected_followers_formatted`] = formatNumber(channel.followersTotal)
        newVariables[`selected_title`] = channel.title
        newVariables[`selected_chat_activity_1m`] = activity1m
        newVariables[`selected_chat_activity_5m`] = activity5m
        newVariables[`selected_chat_activity_15m`] = activity15m
        newVariables[`selected_chat_activity_60m`] = activity60m
        newVariables[`selected_chat_activity_total`] = channel.chatActivity.total
        newVariables[`selected_chat_activity_total`] = channel.chatActivity.total
        newVariables[`selected_chat_mode_emote`] = channel.chatModes.emote.toString()
        newVariables[`selected_chat_mode_followers`] = channel.chatModes.followers.toString()
        newVariables[`selected_chat_mode_followers_length`] = channel.chatModes.followersLength ? channel.chatModes.followersLength.toString() : '0'
        newVariables[`selected_chat_mode_slow`] = channel.chatModes.slow.toString()
        newVariables[`selected_chat_mode_slow_length`] = channel.chatModes.slowLength ? channel.chatModes.slowLength.toString() : '0'
        newVariables[`selected_chat_mode_sub`] = channel.chatModes.sub.toString()
        newVariables[`selected_chat_mode_unique`] = channel.chatModes.unique.toString()
      }
    })

    newVariables.clip_id = this.instance.API.clip.id
    newVariables.clip_url = this.instance.API.clip.url
    newVariables.clip_edit_url = this.instance.API.clip.edit_url

    const channel = this.instance.channels.find((x) => x.id === this.instance.auth.userID)
    if (channel) {
      newVariables.ad_next = channel.adSchedule.next_ad_at
      newVariables.ad_last = channel.adSchedule.last_ad_at
      newVariables.ad_duration = channel.adSchedule.duration
      newVariables.ad_preroll_free_time = channel.adSchedule.preroll_free_time
      newVariables.ad_snooze_count = channel.adSchedule.snooze_count
      newVariables.ad_snooze_refresh = channel.adSchedule.snooze_refresh_at
    }

    this.set(newVariables)
  }
}
