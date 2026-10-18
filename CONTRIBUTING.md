# Contributing

Keep the runtime compatible with Chromium 69 / Tizen 5.5. No optional chaining,
nullish coalescing, unsupported CSS inset/flex-gap assumptions or remote script loaders.
Preserve the existing visual style and deterministic directional focus.

Run the commands in README before sending a change. For playback changes, report
whether a human actually saw the picture and heard sound on a physical TV; advancing
clocks, mock tests and track metadata alone cannot prove audiovisual output.

Add meaningful regression coverage for source/quality/cancellation or paging bugs.
Tests should use local route fixtures, not live provider requests or personal accounts.
Do not add credentials, cookies, DUIDs, signed URLs, private signing profiles or
captured device logs. `.gitignore` is a guard, not permission to store secrets locally.

When reporting model compatibility, include TV model/year, Tizen/firmware, app version,
provider and reproduction steps. Keep private networking details out of public issues.

For third-party code changes, retain license notices, document the source/version and
update the integrity record. Do not add website assets or service logos without an
appropriate redistribution basis. Original contributions use the project's MIT license.
