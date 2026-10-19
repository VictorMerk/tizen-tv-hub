# Movy and Cinejoy clients

Movie Night TV 0.6 adds **Movy / Dallas** and **Cinejoy / Nebula** under the player's
source menu. They reuse the existing catalogue, remote controls, episode picker and
player. They do not install a modern browser or mirror a PC browser.

## Prepare before packaging

The repository contains the adapter and conversion recipe, not copies of the upstream
clients. The build downloads tested public client versions locally and converts them
for Chrome 69. Generated clients, their cache and signed packages are ignored by Git;
do not publish them or any temporary stream addresses.

Install [esbuild](https://esbuild.github.io/getting-started/#install-esbuild) and
[Binaryen](https://github.com/WebAssembly/binaryen/releases), which supplies `wasm-opt`.
The tested tool versions are esbuild 0.28.2 and Binaryen 133. Then run:

```text
py scripts/prepare-sites.py --esbuild PATH_TO_ESBUILD --wasm-opt PATH_TO_WASM_OPT
```

Use absolute executable paths if they are not on PATH. The script pins and checks
the client, dependency and WASM hashes, downloads their dependencies into `.site-build`, and
writes `cinema/site-clients`. A changed entry hash stops the conversion for review.
It does not certify future upstream versions.

Cinejoy's current WASM client uses float-to-int, sign-extension and memory operations
missing from this TV engine. Binaryen lowers those operations to older equivalents;
the API protocol and its request/response protection remain intact. The converted
WASM is bundled locally within the generated client. Other API and media requests
continue through normal native fetch, without fabricated Origin/Referer headers.

If the asset host declines a non-browser download, preparation uses an ordinary
browser context on Cinejoy's site. Install the development requirements and Chromium
first (`py -m pip install -r requirements-dev.txt`, then
`py -m playwright install chromium`), or provide `CHROME_EXECUTABLE` for an existing
Chrome executable. `--wasm-input` can use an original WASM asset downloaded normally.

After preparation, use the signing/build instructions in [INSTALL.md](INSTALL.md).
The generated clients are installed on the TV. Neither the conversion tools nor the
PC must remain running for everyday playback.

## Quality and compatibility

Provider names and available files can change. The menu exposes the sampled usable
paths, rather than every provider listed by the desktop sites. Other Movy endpoints
returned HTTP 403/404 or server errors in the packaged-TV tests. Those responses are
not bypassed. A listed desktop resolution does not guarantee a playable TV rendition.

Separate quality files are switched at the current position. Adaptive sources can
retry a lower available rendition after a decoder failure before trying another
provider. This preserves the saved quality preference; the overlay identifies a
decoder fallback. Selecting a resolution no longer invokes a separate VidRift source action. Failed rendition choices are marked for an explicit retry. Normal failure handling may still try another provider if the current source exhausts its usable renditions.

See [physical verification and limits](COMPATIBILITY.md) for the sampled titles.
Full-film playback, every provider/title, subtitles and 4K are not certified.

## Runtime and privacy

Version 0.6.1 also corrects a narrowly matched MP4 display-metadata case in the
local browser fragment loader: 1920-wide AVC samples, 481:480 pixel aspect and a
1924-wide track header. The init segment is copied and those two display fields
are corrected to square pixels / 1920. This lets Buddy's higher Cinejoy rendition
play on the tested TV. Encoded video/audio samples are not re-encoded or upscaled;
other pixel aspects and media fragments are unchanged. This does not add new
renditions to a provider that only supplies 720p.

Clients load lazily when selected. Small compatibility shims cover `globalThis`,
microtasks, `Object.fromEntries`, and country/language label display. The app still
uses the firmware's browser and Samsung's native decoder where compatible.

Chrome 69 requires `unsafe-eval` in the script policy to compile WebAssembly. Scripts
remain restricted to the installed app; third-party frames remain disabled. This
does broaden the permitted execution mechanisms for installed scripts, and should
be considered when reviewing the locally generated upstream client.

Title identifiers and metadata are sent to the selected service API. See
[PRIVACY.md](PRIVACY.md). No credentials from Netflix, Prime or other installed apps
are read or cleared.
