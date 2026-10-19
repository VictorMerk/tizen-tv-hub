# Changelog

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
