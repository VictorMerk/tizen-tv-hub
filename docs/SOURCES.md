# Source selection and comparison

The interface is an original TV app. Movie Night supplies public catalogue data and
its server API; VidRift supplies an additional ordinary playback path. Site names,
provider names and individual video files are different layers. A different site
can serve a different file, or the same file through another provider.

## Current choices

- **Movy / Dallas** and **Cinejoy / Nebula** use converted ordinary upstream clients. See [preparation](SITE-CLIENTS.md) and [physical sample results](COMPATIBILITY.md). These are source adapters inside our interface, not a modern browser installation. Quality and compatibility vary by title. No 4K claim is made.

- **VidRift / HD bevorzugt** requests the normal Atlas provider option with the
  frontend's H.264 compatibility parameter. Atlas exposed working 1080p variants for
  the tested Buddy and Spider-Man samples. Availability and master quality vary.
- **VidRift / Alternativ** retains the previous automatic provider selection.
- The Movie Night server list remains available. The source menu can compare another
  path at the current position. A provider can return a fallback provider; the
  overlay displays the actual returned provider where supplied.

The app does not transcode or manufacture HD detail. It uses ordinary issued playback
tokens and standard public source requests. Inaccessible sources, authorization
errors and missing renditions remain errors; no headers, signatures or restrictions
are bypassed to make them play.

## Other sites investigated

The user's candidate list corresponds to entries in the
[FMHY video guide](https://fmhy.net/video). That is a discovery list, not a guarantee
that a particular film has a cleaner copy on a particular TV.

| Candidate | What was established |
| --- | --- |
| [Movy](https://www.movy.sx/de) | Dallas adapter plays sampled titles on the TV. Buddy's sampled file is 720p-class. Its catalogue 4K label is not a verified TV playback capability. |
| [Cinejoy](https://cinejoy.pk/) | Converted client and WASM run locally. Version 0.7 adds a TV-local native converter; Nebula played Inception at 2592x1080, Buddy at 1920x1040, and Breaking Bad S1E1 / Spider-Man (2002) at 1920x1080. All four provider choices are reachable; their actual streams remain title-dependent. See the [converter checks](NATIVE-CONVERTER.md). |
| Original VidRift HEVC option | Listed by its ordinary frontend; no reliable direct playback improvement was established in the investigation. |
| Other entries in the supplied list | No complete, current playback/visual-quality verification. They are not bundled as working providers. |

Moving an entire desktop website into an iframe does not change the firmware engine
or automatically provide a different source. Future adapters should preserve the TV
interface, follow the service's ordinary access flow, and demonstrate actual picture
and sound on a physical device before being described as supported.

## Interpreting quality information

The preference defaults to 1080p. A 1920x800 widescreen picture can be the cropped
active image of a 1080p rendition; the app preserves its aspect ratio and shows exact
dimensions in the quality panel. A source at 720p stays lower-resolution even if
1080p is preferred. A 1080p frame can still contain compression or upscaled low-detail
material or a cinema recording. The user briefly found the Buddy preview good, then reported poor quality again while it still decoded at 1920x1080 with zero reported dropped frames. The tested Spider-Man source was identified by the user as a phone/cinema recording. A subsequent Helena source played at 1920x1080 through native AVPlay, but the user also found it unsharp. Frame dimensions alone cannot distinguish those cases.

The measured data rate is compressed main-segment payload bytes divided by segment
duration across up to eight recent samples. It is approximate, scene-dependent and
not a sharpness score. The advertised rate is the manifest's value. These quantities
are not the same as internet speed or a promise of visual quality.

### Inception comparison, 19 October 2026

The user reported blurry/blocky Nebula playback while the TV continued decoding
2592x1080 at approximately 4.7 Mbit/s. The converter preserves compressed samples;
this observation does not establish whether the upstream file was upscaled or
which encoding decision caused its poor detail.

Lisbon advertised a 4K rendition. Its HEVC video initialization and sampled video
fragment returned HTTP 200; both separate audio playlists loaded, but sampled audio
fragments returned HTTP 502 (`origin unavailable`). Its sampled 1080p resource also
returned HTTP 502. A local relay trial did not recover normal playback with sound
and is excluded from the release. Other tested alternatives did not establish a
better working copy. Source availability can change.
