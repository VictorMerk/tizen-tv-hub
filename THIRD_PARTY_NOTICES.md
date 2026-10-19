# Third-party notices

## HLS.js 1.5.18

`cinema/hls.min.js` is the unmodified HLS.js 1.5.18 distribution from the official
[`hls.js` npm package](https://www.npmjs.com/package/hls.js/v/1.5.18).
Upstream: [video-dev/hls.js](https://github.com/video-dev/hls.js).

Copyright (c) 2017 Dailymotion (http://www.dailymotion.com).
Licensed under Apache License 2.0. The upstream notice and full license are in
`cinema/HLS-LICENSE`; the full text is also in `third-party/Apache-2.0.txt`.
HLS.js is loaded locally only when the browser playback path needs it.

## MP4Box.js 0.5.4

`cinema/mp4box.min.js` is the unmodified distribution of
[`mp4box` 0.5.4](https://www.npmjs.com/package/mp4box/v/0.5.4), downloaded from its
pinned npm distribution via jsDelivr. Upstream: [GPAC/mp4box.js](https://github.com/gpac/mp4box.js).
Copyright (c) 2012 Telecom ParisTech/TSI/MM/GPAC Cyril Concolato.
The BSD license and notice are included in `cinema/MP4BOX-LICENSE`.
It loads locally inside the native converter worker. Distribution and license
hashes are checked by `third-party/integrity.json`.

## Platform APIs and service names

Samsung's `webapis` and `tizentvwasm` runtime bindings are provided by the TV and are not distributed here.
The launcher uses installed native icons at runtime where accessible, with plain
text fallback marks. Third-party service logos downloaded during private testing
are not included in this repository. Brand names identify the installed apps and
do not imply endorsement or transfer ownership of trademarks.

Catalogue metadata and media are fetched at runtime from their respective services.
No catalogue dump, movie file, third-party poster collection or account credentials
are distributed. README screenshots use original synthetic poster illustrations.
