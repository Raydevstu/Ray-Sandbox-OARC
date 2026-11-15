# install-ray-memory.ps1 - one-time machine installer for Ray Second-Brain.
# Idempotent: safe to re-run; overwrites ONLY its own outputs (the four
# User-scope env vars, $HOME\.config\opencode\ray-memory.env, and the plugin
# copy under $HOME\.config\opencode\plugins\ray-memory). Never touches
# opencode.jsonc or any other user file.
$ErrorActionPreference = 'Stop'

# --- 1) User-scope env vars (set only if absent or different) ----------------
$wanted = [ordered]@{
  'RAY_MEMORY_ENDPOINT'  = 'http://127.0.0.1:3018'
  'RAY_MEMORY_AGENT_ID'  = 'atlas'
  'RAY_MEMORY_TENANT_ID' = 'sandbox-tenant'
  'RAY_MEMORY_SCOPES'    = 'memory:read memory:write events:write'
}
foreach ($name in $wanted.Keys) {
  $current = [Environment]::GetEnvironmentVariable($name, 'User')
  if ($current -ne $wanted[$name]) {
    [Environment]::SetEnvironmentVariable($name, $wanted[$name], 'User')
    Write-Host "set $name (User scope)"
  }
}

# --- 2) Profile JSON (plugin runtime source of truth, spec D1 shape) --------
$configDir = Join-Path $HOME '.config\opencode'
New-Item -ItemType Directory -Force $configDir | Out-Null
$profilePath = Join-Path $configDir 'ray-memory.env'
$profile = [ordered]@{
  endpoint       = 'http://127.0.0.1:3018'
  tenantId       = 'sandbox-tenant'
  agentId        = 'atlas'
  scopes         = @('memory:read', 'memory:write', 'events:write')
  killSwitch     = $false
  captureEnabled = $true
  recallEnabled  = $true
  recall         = [ordered]@{ budget = 'low'; maxTokens = 1500; timeoutMs = 800 }
  spool          = [ordered]@{ maxEvents = 5000; maxBytes = 52428800 }
}
$json = $profile | ConvertTo-Json -Depth 4
# Desired bytes: UTF-8 without BOM (a BOM would break JSON.parse in the plugin
# core). Compare byte-exactly so a legacy BOM/line-ending variant is rewritten
# once, then the file is truly unchanged on re-runs (hash idempotence).
$desiredBytes = [System.Text.UTF8Encoding]::new($false).GetBytes($json + [Environment]::NewLine)
$desiredB64 = [Convert]::ToBase64String($desiredBytes)
$currentB64 = ''
if (Test-Path $profilePath) {
  $currentB64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($profilePath))
}
if ($currentB64 -ne $desiredB64) {
  [System.IO.File]::WriteAllBytes($profilePath, $desiredBytes)
  Write-Host "wrote profile $profilePath"
}

# ACL: current user only (remove inherited ACEs, grant current user full).
$userId = (whoami)
icacls $profilePath /inheritance:r /grant:r "${userId}:F" | Out-Null

# --- 3) Plugin copy ----------------------------------------------------------
$src = Join-Path $PSScriptRoot '..\plugins\ray-memory'
if (-not (Test-Path $src)) { throw "plugin source not found: $src" }
$dst = Join-Path $configDir 'plugins\ray-memory'
# Mirror the folder exactly (installer-owned path): remove stale files from a
# previous copy, then copy recursively.
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
Copy-Item -Path $src -Destination $dst -Recurse -Force
Write-Host "copied plugin files to $dst"

# Single-file V1 shim (proven loader for OpenCode 1.18.13): auto-discovered
# only when listed in opencode.jsonc `plugin` as a file:// URL; the installer
# does not edit opencode.jsonc, so print the line the user must add.
$shimSrc = Join-Path $PSScriptRoot '..\plugins\ray-memory.js'
$shimDst = Join-Path $configDir 'plugins\ray-memory.js'
if (Test-Path $shimSrc) {
  Copy-Item -Path $shimSrc -Destination $shimDst -Force
  Write-Host "copied V1 shim to $shimDst"
}

Write-Host ''
Write-Host 'Ray Second-Brain installed.'
Write-Host 'NOTE: env vars reach NEW terminals only - open a new terminal before use.'
Write-Host 'Kill switch: set killSwitch:true in ray-memory.env (capture+recall pause).'
