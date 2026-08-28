# companion-module-twitch-api

Module for integration with Twitch through their API and Chat, documentation for that can be found here: https://dev.twitch.tv/docs

User setup, permissions, operating instructions, and troubleshooting are documented in [Companion Help](./companion/HELP.md).

## Development

Use Node.js 22.18 and install the locked dependencies with `yarn install`. Before submitting a change, run:

```sh
yarn prettier --check src tests README.md companion/HELP.md docs/PATCH_NOTES.md .github/workflows/node.yaml
yarn lint:test
yarn build:test
yarn test --runInBand
yarn build
yarn companion-module-build
```

Unit tests mock Twitch responses and must not access Twitch. The Node workflow runs the unit suite in addition to the TypeScript and Companion package builds.

`src/index.ts` owns the Companion instance lifecycle and coordinates configuration, polling, definitions, and connection cleanup. OAuth and permission ownership stay in `src/auth.ts`. Shared Twitch requests and rate-limit accounting stay in `src/api.ts` and its endpoint files. Chat transport and chat-derived state belong to `src/chat.ts`. The action, feedback, variable, and preset files translate those shared services into Companion controls; they should not create competing polling loops or duplicate protocol state.

Raid-browser lifecycle and candidate state transitions live in `src/raidBrowser.ts`; the short-lived Twitch raid countdown estimate lives in `src/raidState.ts`. Actions, variables, feedbacks, and presets consume those centralized states and do not poll Twitch independently. This separation is important because refresh timers, request cancellation, source isolation, selection preservation, and pending-raid expiry must behave identically for every Companion control.

Twitch does not provide a pending-raid polling endpoint. `RaidState` therefore records only start requests accepted by this module, expires them after Twitch's 90-second window, and clears stale state when cancellation reports that no countdown remains. It also retains structured raid-operation errors while publishing a separate 15-second operator-alert window. Do not extend this state into a claim that a raid completed. Verified completion would require a Channel Raid EventSub subscription.

# Patch Notes

**v4.3.0**

- Added a configurable raid-target browser for prioritized Twitch teams and followed live channels
- Added wrapped previous, next, direct-select, refresh, and explicit start-raid actions
- Added default selection from an explicit `up next: @login` title phrase
- Added cancel-raid state, variables, feedback, and a local countdown estimate
- Added transient operator feedback and diagnostic variables for raid API errors
- Added raid candidate tags, language, start time, uptime, and thumbnail metadata
- Added typed button and rotary presets, pagination, source isolation, and refresh concurrency protection
- Selects the first configured channel on startup so selected-channel variables work without a separate action

**v4.2.0**

- Added `Create a Clip from VOD` Action
- Updated `Create a Clip` Action to support Twitch's update to the API endpoint

**v4.1.1**

- Fixed a bug causing a crash when updating chat settings
- Improved error logging

**v4.1.0**

- Added PATCH, PUT, and DELETE, methods for custom API request, as well as defaulting to JSON content type
- Fixed a variable typo on selected channel category id

**v4.0.1**

- Fix for Open Channel NodeJS permissions

**v4.0.0**

- Revamped Oauth process to now use the Device Code Flow (DCF) is used for all module users
- Added config options for the permissions required for various endpoints
- Reworked entire API request logic
- Added more Actions, with more on the roadmap to be added for more complete API coverage where appropriate for a client side application
- Added `clip_id`, `clip_url`, and `clip_edit_url` variables after using the Create Clip Action
- Added `ad_next`, `ad_last`, `ad_duration`, `ad_preroll_free_time`, `ad_snooze_count`, and `ad_snooze_refresh` variables for ad scheduling

**v3.0.4**

- Fix to try resolve excess token server requests

**v3.0.2**

- Added support for Instance Variables in chat messages

**v3.0.1**

- Removed deprecated endpoint

**v3.0.0**

- Updated module for Companion 3
- Replaced most of the deprecated Chat Commands with API requests
- Added additional API functionality in preparation for upcoming features

Older patch notes available in [docs/PATCH_NOTES.md](./docs/PATCH_NOTES.md)
