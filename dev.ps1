# dev.ps1 -- reads .env.local, exports every key into THIS PowerShell session,
# then launches `vercel dev`. Needed because on Windows `vercel dev` does not
# reliably pass .env.local vars to the /api serverless functions (Vite reads them
# for the client fine, but the function process sees them MISSING). Exporting at
# shell level works because Vercel only overrides its own VERCEL_* vars.
#
# Safe to commit: contains NO secrets -- it only reads them at runtime from
# .env.local (which IS gitignored). Run:  .\dev.ps1

$envFile = ".env.local"

if (-not (Test-Path $envFile)) {
    Write-Error "$envFile not found in $(Get-Location). Create it (see .env.example). Aborting."
    exit 1
}

$loadedCount = 0
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        if ($value -match '^"(.*)"$') { $value = $matches[1] }
        elseif ($value -match "^'(.*)'$") { $value = $matches[1] }
        $value = $value -replace "`r$", ""
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
        $loadedCount++
    }
}

Write-Host "[OK] Loaded $loadedCount env vars from $envFile" -ForegroundColor Green
# Run plain Vite — panel_shaq serves its own /api/* in-process via the vercelApiDev
# plugin in vite.config.ts, so `vercel dev` is NOT needed (it only caused a
# frontend/backend port split). One process, one port. We still load .env.local
# into the process above so the api handlers see CLERK_SECRET_KEY / PANELHAUS_API_BASE.
#
# Port 3002 = an allowed Clerk authorizedParty on the PH side (PH uses 5173 + 3001).
# Set PANELHAUS_API_BASE=http://localhost:3001 in .env.local to reach PH's backend.
npx vite --port 3002 --host 0.0.0.0
