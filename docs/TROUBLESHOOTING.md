# Troubleshooting

**Only Auto appears in Quality.** The source may supply one rendition. The menu reports
current picture dimensions and lists source-provided variants if available. Use Andere
Quelle vergleichen for a different source. A 1080p frame size alone does not guarantee
a sharp or high-bitrate master.

**Black picture, no sound or a stalled stream.** Try another source. The native/browser
paths cover different compatibility issues; errors trigger bounded fallback. Back
cancels pending work. Check the same title at another time before assuming a TV fault.
No app can create missing media, supported codecs or provider authorization.

**Catalogue looks empty.** Check internet access and retry the relevant tab. Cached
public catalogue entries expire after 30 minutes. Upstream APIs can change or refuse
requests. Search can find titles outside the current page.

**I see only a small selection.** Use Weitere Titel / Vorherige. The last grid row's
Down key moves to Weitere Titel. Discover mixes movies and series, while the other
tabs show a single type. Back from details retains the page and focus.

**Installation/certificate failure.** Confirm Developer Mode, SDK/TV connectivity,
a Samsung TV distributor certificate containing your DUID, the correct signing
profile and Permit to install applications. Updating with a different author
certificate may be refused. Do not reset Smart Hub or delete existing streaming data
as an installation workaround.

**A streaming app is missing or does not open.** `launcher/apps.js` contains common app
IDs from the tested region. Edit/add the correct installed ID for your TV. TVStart
cannot launch an app that is not installed. Keep descriptions and marks as plain text;
the launcher tries native installed icons and falls back to text tiles.

**TVStart does not appear at power-on.** Samsung resumes the last eligible app, which
can be Netflix. Return to TVStart before power-off and verify your firmware's result.
The Home button still opens Samsung's Home screen.

**Settings or Device Care does nothing.** Native utility IDs differ and an accepted
launch request is not proof a panel opened. Use Samsung Home → Einstellungen and the
manual guidance displayed in TVStart. Avoid Clear data, account reset or Smart Hub
reset if you want to retain your existing logins.
