# companion-module-twitch-api

Module for integration with Twitch through their API and Chat, documentation for that can be found here: https://dev.twitch.tv/docs

## Development

The module keeps OAuth ownership in `src/auth.ts` and shared Twitch request accounting in `src/api.ts`. Raid-browser lifecycle and candidate state transitions live in `src/raidBrowser.ts`; actions, variables, feedbacks, and presets consume that centralized state and do not poll Twitch themselves. This separation is important because refresh timers, cancellation, source isolation, and selection preservation must behave identically for every Companion control.

Use Node.js 22.14 and install the locked dependencies with `yarn install`. Before submitting a change, run:

```sh
yarn prettier --check src tests README.md companion/HELP.md docs/PATCH_NOTES.md .github/workflows/node.yaml
yarn lint:test
yarn build:test
yarn test --runInBand
yarn build
yarn companion-module-build
```

Unit tests mock Twitch responses and must not access Twitch. The Node workflow runs the unit suite in addition to the TypeScript and Companion package builds.

# Patch Notes

**v4.3.0**

- Added a configurable raid-target browser for prioritized Twitch teams and followed live channels
- Added wrapped previous, next, direct-select, refresh, and explicit start-raid actions
- Added raid candidate variables, feedbacks, presets, pagination, source isolation, and refresh concurrency protection

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
