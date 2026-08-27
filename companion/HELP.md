## Twitch API and Chat test

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

Enable the Raid Target Browser in the connection config, then enter Twitch team names separated by commas or new lines. Candidates are grouped in the configured team order, followed by live channels that the authenticated user follows. Each group is sorted by viewer count. A channel that occurs in more than one source appears only in its first source, and the authenticated broadcaster is excluded.

To include followed live channels, enable both **Include Followed Live Streams** and **Read Followed Live Streams**. The second option adds the `user:read:follows` OAuth scope. Save the config and authenticate again after changing permission options. Without that scope, team browsing continues and Companion logs one warning for the current configuration and authentication state.

Starting a raid is separate from browsing or changing the selection. Enable the **Raids** broadcaster permission and authenticate again before using **Raid Browser: Start Raid to Selected Candidate** or **Start Raid by Login**. The browser never starts a raid automatically.

For a rotary encoder, assign **Raid Browser: Select Previous Candidate** and **Raid Browser: Select Next Candidate** to the encoder directions. The raid candidate variables can supply LCD text, including display name, source, viewers, category, title, current index, and count. Both direction actions wrap at the ends of the list. Use **Raid Browser: Refresh Candidates** for an on-demand update. Set the refresh interval to `0` to disable automatic refresh.

If no candidates appear, press **Raid Browser: Refresh Candidates**, then inspect the Twitch connection entries in Companion's Logs tab. A completed refresh reports its final candidate count and the live-channel count returned by each source. The `raid_browser_status`, `raid_browser_last_refresh`, `raid_browser_last_error`, and `raid_browser_source_summary` variables expose the same lifecycle state for diagnostics or control-surface displays. Twitch team and followed-stream failures are isolated, so a failed source does not remove candidates returned by another source.

### Twitch Rate Limits

- API Requests: 800 per minute
- Chat messages in channel without Moderator/Broadcaster status: 20 per 30 seconds.
- Chat messages in channel with Moderator/Broadcaster status: 100 per 30 seconds.
