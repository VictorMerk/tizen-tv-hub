# Changelog

## Movie Night TV 0.6.1

- Correct the matched 1920-wide AVC / 481:480 pixel-aspect MP4 metadata that made Chromium 69 report a 1924-wide picture and reject Buddy's higher Cinejoy rendition. Encoded video and audio samples are unchanged.
- Physically test Buddy at 1920x1040 on Cinejoy / Nebula; the user confirmed a sharper picture with working sound.
- Cover the correction, unchanged square/anamorphic media, truncated input, original-buffer preservation and loader callbacks with synthetic MP4 fixtures.

## Movie Night TV 0.6

- Add lazy-loaded Movy / Dallas and Cinejoy / Nebula adapters using locally converted ordinary service clients. No PC is needed during playback.
- Convert Cinejoy's WASM operations for Chrome 69 and provide the required small browser compatibility shims.
- Switch separate resolution files at the current position and retry lower adaptive renditions before leaving a service after decoder failure.
- Fix native selection of the lowest bitrate when a playlist omits resolution metadata.
- Remove the misleading 1080p action that switched to VidRift from the quality menu.
- Add fixture coverage for source metadata, cancellation, empty responses, file switching, decoder fallback and missing-resolution ladders.
- Document per-title playback limits; a listed 1080p/4K source is not a guarantee of supported TV playback.

## Movie Night TV 0.5 / TVStart 2.2

- Prefer the normal VidRift Atlas H.264 source path; retain the old provider path as an explicit alternative.
- Default to a retained 1080p preference; retain manual/Auto selection across sources, films and reloads.
- Show actual decoded resolution separately from the preference and expose approximate measured bitrate where available.
- Distinct blue TVStart and gold Movie Night icons, with editable SVG sources and a renderer.
- Cover provider parameters, preference persistence, lower-available rendition selection and bitrate measurement with fixture tests.

## Movie Night TV 0.4 / initial public release

- Paged movie and series catalogues and an interleaved Discover view, up to 40 unique
  titles per page; previous/next navigation remains accessible with a TV remote.
- Catalogue page and selected title restored after viewing details.
- Actual decoded dimensions in the quality menu, HLS variant discovery from the player,
  height-based browser selection, and a direct action to compare another source.
- Single-rendition sources explained instead of implying extra resolutions exist.
- Standalone catalogue/details/player interface, native AVPlay and local browser HLS
  decoder, resume positions, series selection, cancellation and bounded fallback.
- TVStart app selector with favorites, reordering, fast mode and existing app launches.
- Clean public source export, portable fixture tests, Windows signing/package helper,
  installation/privacy/compatibility documentation and continuous integration.
