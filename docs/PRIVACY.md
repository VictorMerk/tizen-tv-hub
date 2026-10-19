# Data flow and privacy

TVStart stores favorites, order, selection, fast-mode preference and launch timing in
its own localStorage. It reads the installed app list to match known app IDs and load
native icons when possible. The public distribution bundles no third-party service logos.
It does not access streaming-app cookies, passwords or profile data.

Movie Night sends catalogue/search/title requests to `movienig.ht`. Its ordinary source
API supplies playback URLs. The VidRift path requests the normal embed metadata from
`embed.vidrift.in`, then uses the playback token issued there to request sources.
Movy source requests go to `api.wecollege.net`; Cinejoy source requests go to `api.wing.st`, using their ordinary client protocol. Title identifiers, title/year and episode numbers are sent as needed. Converted service clients and Cinejoy's converted WASM are installed locally. Media requests go to the returned hosts; these services can see the TV's network address and
requested title. There is no project-operated proxy or analytics service.

Successful public catalogue responses are cached for 30 minutes with bounded storage.
Resume positions, episode numbers and selected provider IDs are kept for up to 30 titles. A global quality preference is also stored locally. Recent media-segment byte/duration totals are held in memory to estimate the stream data rate; media payloads are not retained by that feature.
Stream URLs and playback tokens stay in memory and are not written to the resume cache.
The native converter holds up to two converted fragments in RAM during playback.
Its HTTP listener binds only to the TV's loopback address and uses a random session
path. It forwards only registered media resources. Closing playback stops the worker,
aborts its fetches and closes its sockets. Converted media is never written to disk.
See [the converter data path](NATIVE-CONVERTER.md).
Runtime diagnostics are bounded and stay in the app's memory. No telemetry is uploaded
to the repository owner. Upstream services have their own policies and availability.

The apps do not clear Samsung service data, reset Smart Hub, alter firmware or sign
users out of installed streaming apps. No installation step needs account-data cleanup.

Do not attach tokens, cookies, full signed playback URLs, certificate files, DUIDs or
private IP/device logs to a public issue. Report model/year, Tizen/firmware version,
app version, selected provider, visible error and reproduction steps instead.

The Chrome 69 script policy permits WebAssembly compilation with `unsafe-eval`; scripts remain limited to installed files and remote frames remain disabled. See [client preparation and review](SITE-CLIENTS.md). The final app does not require filesystem privileges.
