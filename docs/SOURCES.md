# Source selection and comparison

The interface is an original TV app. Movie Night supplies public catalogue data and
its server API; VidRift supplies an additional ordinary playback path. Site names,
provider names and individual video files are different layers. A different site
can serve a different file, or the same file through another provider.

## Current choices

- **VidRift / HD bevorzugt** requests the normal Atlas provider option with the
  frontend's H.264 compatibility parameter. Atlas exposed working 1080p variants for
  the tested Buddy and Spider-Man samples. Availability and master quality vary.
- **VidRift / Alternativ** retains the previous automatic provider selection.
- The Movie Night server list remains available. The quality menu can try the HD
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
| [Movy](https://www.movy.sx/de) | Catalogue includes Buddy in a 4K section. A clean 4K stream and TV playback were not verified. |
| [Cinejoy](https://cinejoy.pk/) | Current client needs modern JavaScript; a required bootstrap fragment fails on Chromium 69. A TV adapter and playback verification would be required. |
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
material or a cinema recording. The user confirmed that the latest Buddy preview looked good, but identified the tested Spider-Man source as a phone/cinema recording. Frame dimensions alone cannot distinguish those cases.

The measured data rate is compressed main-segment payload bytes divided by segment
duration across up to eight recent samples. It is approximate, scene-dependent and
not a sharpness score. The advertised rate is the manifest's value. These quantities
are not the same as internet speed or a promise of visual quality.
