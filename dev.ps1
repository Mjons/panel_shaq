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
$env:VERCEL_ENV = "development"
vercel dev -l 3000
