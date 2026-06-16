#!/usr/bin/env bash
# dev.sh -- reads .env, exports every key into THIS shell session, then
# launches Vite. Mirrors dev.ps1 (the Windows launcher) for Linux/macOS. Needed
# because the /api serverless handlers read server vars (CLERK_SECRET_KEY /
# PANELHAUS_API_BASE) from the process env, not from Vite's client env.
#
# Safe to commit: contains NO secrets -- it only reads them at runtime from
# .env (which IS gitignored). Run:  ./dev.sh
set -euo pipefail

env_file=".env"

if [[ ! -f "$env_file" ]]; then
  echo "Error: $env_file not found in $(pwd). Create it (see .env.example). Aborting." >&2
  exit 1
fi

loaded_count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#"${line%%[![:space:]]*}"}"   # ltrim
  [[ -z "$line" || "$line" == \#* ]] && continue
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
    name="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value%$'\r'}"                    # strip trailing CR (CRLF files)
    if [[ "$value" =~ ^\"(.*)\"$ ]]; then value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    export "$name=$value"
    loaded_count=$((loaded_count + 1))
  fi
done < "$env_file"

echo "[OK] Loaded $loaded_count env vars from $env_file"

# Run plain Vite -- panel_shaq serves its own /api/* in-process via the
# vercelApiDev plugin in vite.config.ts, so `vercel dev` is NOT needed.
# One process, one port.
#
# Port 3002 = an allowed Clerk authorizedParty on the PH side (PH uses 5173 + 3001).
# Set PANELHAUS_API_BASE=http://localhost:3001 in .env.local to reach PH's backend.
exec npx vite --port 3002 --host 0.0.0.0
