## Twitch API and Chat

### Features

- Display live status, uptime, and viewers, of multiple Twitch streams.
- Connect to Twitch chat and control which chat modes are active, as well as perform moderation commands like Clear Chat.
- Send predefined messages to a channel.
- Execute API request to run channel advertisements (if available), create stream markers, and run custom API requests.
- Browse prioritized live raid targets from Twitch teams and followed channels, then start a raid only after an explicit action.
- OAuth flow to handle generation of tokens with just the permissions you need, and the option to store them entirely locally, or manged by a token server.

### Permissions

Before getting started, please note that some functions require an Auth token from the streamer themselves (such as starting an ad break, or getting subscriber counts), some may be usable by a channel moderator/editor, and some may be usable by anyone (for example, any user can monitor if any other streamer is live or not, or the status of their chat modes). Please keep this in mind so that you auth while logged in to the appropriate Twitch account for what you wish to control with Companion.

### Getting started

The first thing you will need to do is set up which channels you wish to monitor, this list of channels will be tracked for when they go online/offline, track chat, and be usable in Actions/Feedbacks. The first configured channel is selected automatically; a **Select Channel** action can change the active selected-channel variables later.

Next you will need to do after adding the Twitch instance to Companion is set up what permissions you plan to use in the Config screen for the connection. Keep in mind that some API requests require permissions from the broadcaster themselves, some can use permissions from a moderator or editor, and some can be done by any user.

For example, starting ads requires the broadcaster themselves to auth with the Companion app, but a Shoutout can be done with moderator permissions so the user going through the OAuth process in Companion can do shoutouts on any channel they are a moderator of.

Once the scopes have been selected, save the config, and then go back into the config screen and follow the link to the Auth URL to go through the OAuth process.

### Raid Target Browser

Enable the Raid Target Browser in the connection config, then enter Twitch team names separated by commas or new lines. For example, `team-one, team-two, team-three` checks `team-one` first. Candidates are grouped in the configured team order, followed by live channels that the authenticated user follows. Each group is sorted by viewer count. A channel that occurs in more than one source appears only in its first source, and the authenticated broadcaster is excluded.

To include followed live channels, enable both **Include Followed Live Streams** and **Read Followed Live Streams**. The second option adds the `user:read:follows` OAuth scope. Save the config and authenticate again after changing permission options. Without that scope, team browsing continues and Companion logs one warning for the current configuration and authentication state.

Starting a raid is separate from browsing or changing the selection. Enable the **Raids** broadcaster permission and authenticate again before using **Raid Browser: Start Raid to Selected Candidate**, **Start Raid by Login**, or **Cancel Pending Raid**. The browser never starts a raid automatically.

Raid start and cancel always apply to the Twitch account that authenticated this connection. The **Channels to monitor** list does not grant authority over those channels and does not select the channel that sends a raid. Monitoring several channels will not start several raids.

The selected monitored channel is connection state, not a writable Companion variable. A fresh connection selects the first configured channel. The **Select Channel** action can change it later. It controls selected-channel variables and actions configured to use **Selected**. It never changes the authenticated raid source or the broadcaster title examined by **Raid Browser: Refresh and Select Default Candidate**.

#### Browsing with buttons or an encoder

The **Browse raid candidates with a rotary encoder** preset provides previous and next rotation actions and refreshes the list when pressed. The separate previous, next, refresh, start, cancel, and candidate-details presets can be combined into a custom surface layout. Previous and next selection wrap at the ends of the list.

**Raid Browser: Refresh Candidates** updates the list while preserving the selected broadcaster when that broadcaster remains live. **Raid Browser: Refresh and Select Default Candidate** instead looks for an explicit `up next: @login` phrase in its Suggestion Text. When Suggestion Text is blank, it fetches the authenticated broadcaster's current channel title from Twitch. It selects that live candidate when found, otherwise it selects candidate 1. Other `@mentions` are intentionally ignored so a guest or sponsor mention cannot silently become the raid target.

The connection's refresh interval controls automatic refreshes. The default is 60 seconds. Set it to `0` to disable automatic refresh. Manual refresh actions still work when automatic refresh is disabled.

#### Example layouts

The [Stream Deck + example page](assets/streamdeck-plus-raid-browser.companionconfig) and [Stream Deck + XL example page](assets/streamdeck-plus-xl-raid-browser.companionconfig) demonstrate complete Companion 5 layouts. They are page-only exports with a placeholder `Twitch` connection and contain no authentication data, connection settings, channel names, team names, surface identifiers, or custom-variable dependencies. Import one through the Buttons tab, then map `Twitch` to your authenticated Twitch API connection. Both expect the surface at the page grid origin.

Each example assigns start or cancel to `1/0/0`, previous selection to `1/1/0`, and next selection to `1/1/1`. The Stream Deck + uses contiguous LCD and encoder columns on rows `2` and `3`. The Stream Deck + XL uses rows `4` and `5` at its verified sparse columns `3`, `5`, `6`, and `8`. The rightmost assigned encoder browses candidates. Every assigned encoder push cancels a pending raid, while the browser-encoder push refreshes the default candidate when no raid is pending.

The example files are plain, formatted JSON stored with Companion's `.companionconfig` extension. Each file is directly importable and readable in a source diff. There is no generated or compressed duplicate to keep synchronized.

#### Candidate metadata and displays

Candidate variables include the index, count, login, display name, viewer count, category, title, tags, language, stream start time, calculated uptime, source, and Twitch thumbnail URL. The tags variable is a comma-separated display value; the JSON variant preserves the original array for expressions. The thumbnail URL contains Twitch's `{width}` and `{height}` placeholders, which a consumer must replace with pixel dimensions before requesting the image.

Variables are resolved through the Companion connection label. If the connection is labeled `Twitch`, a manually entered reference is `$(Twitch:raid_candidate_login)`. Connection labels are case-sensitive.

#### Starting and canceling a raid

When Twitch accepts a start request, it opens a 90-second raid countdown. The module publishes `raid_pending`, target, creation time, expiry time, and estimated seconds remaining. **Cancel Pending Raid** sends Twitch's cancellation request. The **Raid Pending** feedback can color or switch a control while the local countdown is active.

A failed start or cancellation publishes `raid_error_active`, the HTTP status, Twitch's error message, and the occurrence time. The active indicator lasts 15 seconds so a surface can show or flash an operator alert; the details remain available afterward for diagnostics. **Raid Browser: Acknowledge Error** clears both the visible alert and its retained details after the operator has read it. The **Raid Error Active** feedback provides the same transient signal for presets and custom buttons. In particular, Twitch limits start and cancel requests to 10 requests in 10 minutes, so a `429` response should be displayed rather than retried automatically.

Twitch does not provide an endpoint for polling the countdown. If the broadcaster clicks Raid Now in Twitch before the countdown expires, the module cannot observe that early completion without EventSub and may continue to report a local pending estimate. A later cancel attempt receives Twitch's not-found response and clears the local state. This limitation is why the variables and feedback say pending rather than active or completed.

#### Troubleshooting

If no candidates appear, press **Raid Browser: Refresh Candidates**, then inspect the Twitch connection entries in Companion's Logs tab. A completed refresh reports its final candidate count and the live-channel count returned by each source. The `raid_browser_status`, `raid_browser_last_refresh`, `raid_browser_last_error`, and `raid_browser_source_summary` variables expose the same lifecycle state for diagnostics or control-surface displays. Twitch team and followed-stream failures are isolated, so a failed source does not remove candidates returned by another source.

If actions change the selection but a display remains blank, verify that every variable reference uses the connection's exact label and capitalization. The Companion variable API can confirm a value directly. For a connection labeled `Twitch`, request `/api/variable/Twitch/raid_candidate_login/value` from Companion's HTTP port.

### Twitch Rate Limits

- API Requests: 800 per minute
- Chat messages in channel without Moderator/Broadcaster status: 20 per 30 seconds.
- Chat messages in channel with Moderator/Broadcaster status: 100 per 30 seconds.
