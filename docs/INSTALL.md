# Install TVStart and Movie Night TV

These instructions use Samsung's normal developer installation workflow. Installing
ordinary apps does not require resetting Smart Hub or signing out of existing TV apps.
The computer is needed for setup and updates, not everyday playback.

## 1. Install the tools

Install [Tizen Studio and the Samsung TV SDK extensions](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html).
In Package Manager install Web CLI, the TV extension and Samsung Certificate Extension.
You need a Samsung developer account for the certificate workflow.

## 2. Enable TV Developer Mode and connect

Follow Samsung's [TV Device guide](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html).
On supported TVs, open Apps and enter **1 2 3 4 5** to show Developer Mode. Enable it,
enter your computer's LAN address and restart the TV as instructed. UI varies by model.
Your PC and TV must be able to reach each other on the same network.

Open Tizen Studio Device Manager, add the TV as a remote device and connect. Alternatively:

```text
sdb connect YOUR_TV_IP:26101
sdb devices
```

Use `sdb` from your SDK's `tools` folder. Copy your device serial from the output.
Do not expose the TV's developer/debugging ports to the public internet.

## 3. Create your own certificate

In Certificate Manager, create a **Samsung TV** certificate profile, with an author
certificate and a distributor certificate including your TV's DUID. See Samsung's
[certificate instructions](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).
In Device Manager, right-click your TV and choose **Permit to install applications**
when available. Keep the author certificate safe and private: later updates should
use the same author certificate. Never commit a `.p12`, profile password or DUID.

## 4. Build and install on Windows

From the repository root, in PowerShell:

```powershell
.\scripts\build.ps1 -Profile "YourCertificateProfile" -TizenStudio "C:\tizen-studio"
.\scripts\build.ps1 -Profile "YourCertificateProfile" -Deploy -Device "YOUR_DEVICE_SERIAL"
```

The second command rebuilds and installs both apps to the explicitly selected device.
Use `-Target launcher` or `-Target cinema` to install only one. Signed packages appear
in `builds/TVStart.wgt` and `builds/MovieNightTV.wgt` and are intentionally ignored by Git.
The build copies only whitelisted source files into a new staging folder.

If execution policy prevents the local script, use the normal policy allowed on your
computer or build through Tizen Studio; do not change machine-wide policy for this project.

### macOS/Linux or IDE installation

The supplied PowerShell build helper is tested on Windows. On other supported SDK hosts,
use Samsung's CLI or import each app folder as an existing Tizen Web project. The runtime
has no build/transpile step. Sign each folder with your own profile:

```sh
tizen package -t wgt -s YourCertificateProfile -o builds -- launcher
tizen package -t wgt -s YourCertificateProfile -o builds -- cinema
tizen install -s YOUR_DEVICE_SERIAL -n TVStart.wgt -- builds
tizen install -s YOUR_DEVICE_SERIAL -n MovieNightTV.wgt -- builds
```

Create `builds` first. These non-Windows commands follow the SDK CLI documentation;
they have not been physically verified on those hosts. Never store signing material
inside an app folder. See Samsung's [CLI reference](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).

## 5. Open the apps

Open TVStart and MovieNightTV from the TV's Apps screen. Add TVStart to Samsung Home
and move it near the left. TVStart opens installed streaming services without changing
their account data. Hold OK over Movie Night in Alle Apps to pin it if necessary.

For last-app startup on the tested Q60T, look under **Einstellungen → Allgemein →
Smart-Funktionen**: enable **Letzte App automatisch ausführen** and, if offered,
disable **Smart Hub automatisch starten**. Return to TVStart before turning the TV off.
If Netflix was last, Netflix can reopen instead. Check your actual power-cycle result;
this project does not force boot routing or remap the remote's Home button.

## Updates and removal

Pull new source, rebuild with the same signing profile, and install over the existing
package. Do not uninstall first if you want to retain that app's local favorites/history.
Uninstall TVStart or MovieNightTV through Samsung Apps if you no longer want them;
that removes their own local data, not Netflix or Prime accounts.
