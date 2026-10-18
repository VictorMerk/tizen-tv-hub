# Data flow and privacy

TVStart stores favorites, order, selection, fast-mode preference and launch timing in
its own localStorage. It reads the installed app list to match known app IDs and load
native icons when possible. The public distribution bundles no third-party service logos.
It does not access streaming-app cookies, passwords or profile data.

Movie Night sends catalogue/search/title requests to `movienig.ht`. Its ordinary source
API supplies playback URLs. The VidRift path requests the normal embed metadata from
`embed.vidrift.in`, then uses the playback token issued there to request sources. Media
requests go to the returned hosts; these services can see the TV's network address and
requested title. There is no project-operated proxy or analytics service.

Successful public catalogue responses are cached for 30 minutes with bounded storage.
Resume positions, episode numbers and selected provider IDs are kept for up to 30 titles.
Stream URLs and playback tokens stay in memory and are not written to the resume cache.
Runtime diagnostics are bounded and stay in the app's memory. No telemetry is uploaded
to the repository owner. Upstream services have their own policies and availability.

The apps do not clear Samsung service data, reset Smart Hub, alter firmware or sign
users out of installed streaming apps. No installation step needs account-data cleanup.

Do not attach tokens, cookies, full signed playback URLs, certificate files, DUIDs or
private IP/device logs to a public issue. Report model/year, Tizen/firmware version,
app version, selected provider, visible error and reproduction steps instead.
