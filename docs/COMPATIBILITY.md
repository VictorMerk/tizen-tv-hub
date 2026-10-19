# Compatibility and verification

## Physically checked

- Samsung Q60T (2020), model family GQ65Q60TGUXZG.
- Tizen 5.5, Chromium 69, firmware 2743.0.
- Public release baseline: Movie Night TV 0.6 and TVStart 2.2.

Samsung documents its engine versions in [Web Engine Specifications](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html).
The manifest requires Tizen 5.5. Newer models may work but have not been physically
verified. Earlier Tizen versions are unsupported by the current manifest/runtime.

## Sampled physical playback, 18 October 2026

| Sample | Observed result |
| --- | --- |
| Resident Evil sample | User confirmed picture and sound with AVPlay; native 1080p selection checked |
| Inception | User confirmed picture and sound with browser decoder; installed-package remote pause/resume and seek checked |
| The Odyssey | User confirmed picture and sound; reported 1920×1000 |
| Breaking Bad S1E1 | User confirmed picture and sound; actual dimensions switched 1920×1080 → 1280×720 and retained position |
| The Dark Knight | Reported 1920×800 and advancing playback with audio metadata; no separate physical sound confirmation |
| Spider-Man (2002) | Reported 1920×1080; sampled source supplied no alternate resolution ladder |

These are bounded sample checks. Advancing clocks and metadata alone do not prove
that a human sees/hears output. Full-film playback, every title/provider, every audio
track, 4K and subtitles are not certified.

The paged update showed 39 unique mixed titles on page 1 and 40 on page 2 in a live
catalogue sample. Back from details restored page 2 and the selected tile. Earlier
warm catalogue renders measured about 1.1–2.8 seconds; those are neither cold-start
guarantees nor system-wide speedup measurements. One page is rendered at a time.

## Known limits

The Samsung browser engine comes from firmware. A wrapper/iframe does not upgrade it.
The project uses syntax compatible with Chromium 69 and provides its own smaller UI.
It does not install a newer engine, root the TV, replace Smart Hub or force startup.

Native Settings/Device Care IDs and streaming app IDs can vary by model and region.
Samsung may accept a launch request without displaying a utility panel; use the manual
Settings path when needed. The launcher is an app selector, not a system cleaner.

Provider failures include inaccessible or expired sources, missing titles, incompatible
codecs and network problems. A second provider may differ in language, transfer or
quality. Adaptive playback cannot improve a poor source master.

## Automated coverage

Fixtures mock TV APIs and source responses. Tests cover remote focus, last-row paging,
page restoration, source/audio/quality menus, bitrate selection, decoder fallback,
late callback cancellation, episode progression and local launcher assets.
Browser decoder lifecycle tests also ignore events from a removed video element.
None of these mocks substitutes for model-specific physical audiovisual verification.

## Quality investigation, 19 October 2026

For Spider-Man: Brand New Day, the previous provider returned separate 2592x1080, 1728x720 and 1152x480 files. The 1080-height file produced a browser media error; the app then played the lower file. The normal Atlas option decoded 1920x800 from a declared 1080p rendition without that error. Buddy decoded 1920x1080 on Atlas. The user initially described Buddy as blurry/blocky, briefly found a later preview good, then reported poor quality again. At that later report the TV still decoded 1920x1080 with zero reported dropped frames; a sustained visual improvement was not established. The user identified the currently tested Spider-Man source as a phone/cinema recording despite its HD frame dimensions. These are sample-specific observations, not proof of a clean master for every title.

A sampled Atlas Buddy stream advertised 5 Mbit/s while recent segment payloads measured roughly 3 Mbit/s; the measurement varies by scene. An alternative Tucson rendition also failed on this TV, and the original HEVC provider was not established as a usable direct source. No general claim of sharper pictures or 4K support follows from these tests.

The unmodified Cinejoy client code contains nullish-coalescing syntax. A required 96-byte Svelte bootstrap fragment failed to compile on this TV with `Unexpected token ?`. Version 0.6 now converts its client and WASM for the TV; the results below supersede the earlier unmodified-client limitation. Movy's 4K catalogue label was not verified as playable 4K on this TV. See [source comparison](SOURCES.md).

A later bounded Buddy comparison found no source on Vienna/Austin/Zurich/Lisbon; Kyoto offered only 720p in the sampled playlist. Salem and Helena advertised 1080p. Helena prepared and played through Samsung AVPlay at reported 1920x1080 (declared 5.43 Mbit/s), preserving the position. The user reported that Helena was still not sharp. Neither tested path established a satisfactory clean picture. Provider availability can change.


## Movy and Cinejoy adapters, 19 October 2026

Both clients were packaged locally and checked after installation. Native fetch remained intact: no development PC browser, resolver or playback server was involved in these TV requests. The TV still uses Chromium 69, not a newly installed browser.

| Sample | Adapter | Observed result |
| --- | --- | --- |
| Buddy | Movy / Dallas | Native player reported 1280x692. User confirmed picture and sound, but wanted 1080p. The sampled playlist only advertised that 720p-class rendition. |
| Buddy | Cinejoy / Nebula | Browser decoder failed on the higher rendition (read as 1924x1040), then the installed app retried at 1280x692 on Cinejoy. The user reported it was still 720p. |
| Inception | Cinejoy / Nebula | Higher rendition failed; retry played at reported 1728x720. |
| Inception | Movy / Dallas | Missing-resolution selection fix increased reported playback from 640x266 (0.24 Mbit/s) to 1280x534 (1.01 Mbit/s). |
| Breaking Bad S1E1 | Cinejoy / Nebula | Fresh installed-package playback advanced at reported 1920x1080. This establishes that this service is not universally limited to 720p on the TV. |
| Breaking Bad S1E1 | Movy / Dallas | Playlist omitted resolution labels. Before the selection fix it played 640x360; selecting the higher 3.5 Mbit/s rung played 1280x720. |

Advancing clocks and track metadata do not independently prove audible output or visual sharpness. Only the stated user confirmations are human verification; full-film playback and 4K remain unverified. Samsung native decoder configuration and a typed local-playlist experiment did not recover Buddy's higher rendition; the experimental files were removed and filesystem privileges are not part of the final app.

Other sampled Movy providers returned HTTP 403/404 or server errors on this packaged TV app. Cinejoy Lisbon/Athens did not return a usable Buddy source, and Solara's sampled playlist returned HTTP 403. These paths are not advertised as working menu options. No response restriction was bypassed. See [client setup](SITE-CLIENTS.md).
