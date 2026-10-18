param(
    [ValidateSet('all','launcher','cinema')][string]$Target = 'all',
    [Parameter(Mandatory=$true)][string]$Profile,
    [string]$TizenStudio = $(if ($env:TIZEN_STUDIO) { $env:TIZEN_STUDIO } else { 'C:\tizen-studio' }),
    [switch]$Deploy,
    [string]$Device
)
$ErrorActionPreference = 'Stop'
if ($Deploy -and -not $Device) { throw 'Pass -Device with the serial shown by sdb devices.' }
$cli = Join-Path $TizenStudio 'tools\ide\bin\tizen.bat'
if (-not (Test-Path -LiteralPath $cli)) { throw 'Tizen CLI missing. Install Web CLI and pass -TizenStudio.' }
$root = Split-Path $PSScriptRoot -Parent
$outputRoot = Join-Path $root 'builds'
$stageRoot = Join-Path $root ('.build-stage\' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $outputRoot,$stageRoot | Out-Null
$projects = @(
    @{Name='launcher'; Package='TVStart.wgt'; Files=@('start.html','config.xml','icon.png','launcher.css','launcher.js','apps.js')},
    @{Name='cinema'; Package='MovieNightTV.wgt'; Files=@('index.html','config.xml','icon.png','tv-service.js','tv-ui.js','tv-player.js','tv-browser-player.js','tv-ui.css','hls.min.js','HLS-LICENSE')}
)
foreach ($project in $projects) {
    if ($Target -ne 'all' -and $Target -ne $project.Name) { continue }
    $stage = Join-Path $stageRoot $project.Name
    New-Item -ItemType Directory $stage | Out-Null
    foreach ($name in $project.Files) {
        Copy-Item -LiteralPath (Join-Path (Join-Path $root $project.Name) $name) -Destination $stage
    }
    $result = & $cli package -t wgt -s $Profile -o $outputRoot -- $stage 2>&1
    $result | Write-Output
    if ($LASTEXITCODE -ne 0 -or -not ($result -match 'Package File Location:')) { throw 'Packaging failed.' }
    if (-not (Test-Path -LiteralPath (Join-Path $outputRoot $project.Package))) { throw 'Expected package missing.' }
    if ($Deploy) {
        $result = & $cli install -s $Device -n $project.Package -- $outputRoot 2>&1
        $result | Write-Output
        if ($LASTEXITCODE -ne 0 -or -not ($result -match 'Tizen application is successfully installed')) { throw 'Installation failed.' }
    }
}
