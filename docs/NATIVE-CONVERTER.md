# TV-local native playback converter

Movie Night TV 0.7 repackages supported Cinejoy streams on the TV before sending
them to Samsung AVPlay. This recovers higher renditions that Chromium 69's MSE
decoder rejects. It does not install a new browser engine or upscale video.

## Data path

1. The ordinary Cinejoy client returns a stream URL.
2. A local worker selects the requested HLS rendition and fetches its init segment.
3. MP4Box.js extracts compressed AVC and AAC samples from each fMP4 fragment.
4. The app packages those samples as MPEG-TS, preserving video, audio and timestamps.
5. Samsung's native player reads the converted HLS through an ephemeral HTTP listener
   bound to **127.0.0.1 only**. The TV downloads all original media itself.

No PC, cloud converter, disk cache, FFmpeg runtime or additional native installation
is required. The app uses Samsung's TV socket bindings described in its Emscripten
SDK and the existing Internet privilege. No filesystem privileges are requested.
The player falls back to the browser path if this converter cannot prepare a source.

## Limits and cleanup

The converter supports finite HLS with an init segment, one AVC video track and one
AAC-LC audio track. Separate audio groups, HEVC, encrypted streams, byte-range HLS,
changing initialization segments and live playlists are not converted. A provider
may still fail before reaching the converter or may supply only a lower rendition.

Remote URLs are registered from service playlists; HTTP requests cannot specify an
arbitrary upstream URL. Each session uses a random 128-bit path token. The listener
accepts only GET/HEAD, bounds headers, clients, fetch sizes and timeouts, and supports
byte-range responses. At most two converted fragments are cached in RAM. Closing or
changing playback aborts requests, closes sockets and terminates the worker.

The native player sometimes reports a placeholder bitrate of 99,999,999. The UI uses
the selected playlist bitrate and recent original fragment bytes/durations instead.
Decoded dimensions still come from the native video track. With this path, Auto
selects the highest offered rendition up to 1080p at startup; manual resolution
changes reopen that rendition near the current position.

## Physical verification

On the tested 2020 Q60T, the installed 0.7 package played these Cinejoy / Nebula samples:

| Title | Native decoded dimensions |
| --- | --- |
| Inception | 2592x1080 |
| Buddy | 1920x1040 |
| Breaking Bad S1E1 | 1920x1080 |
| Spider-Man (2002) | 1920x1080 |

Inception passed 720p-to-1080p switching, position retention, pause/resume and seeking.
The user confirmed that the normal player showed 1080p and picture and sound worked.
The other rows are bounded track/clock checks, not separate human confirmation of
every output. Full-film playback, every title and 4K are not certified. Inception's
2592x1080 copy is an extra-wide 1080p-height image; it is not 3840x2160 UHD.

Tests use an original synthetic test-pattern fixture. They verify transport packets,
PAT/PMT CRCs, continuity counters, PCR/PTS/DTS, byte-identical compressed samples,
unsupported-format rejection, cancellation, loopback binding, route isolation,
partial writes and HTTP ranges. A private FFmpeg decode check of a converted sample
also completed without decoder errors; FFmpeg is not shipped or needed on the TV.
