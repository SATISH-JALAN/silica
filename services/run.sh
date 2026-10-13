#!/usr/bin/env bash
# Container entrypoint: start every process named in SERVICE (comma-separated, e.g.
# "agent,mm"), and exit as soon as one of them dies so the host restarts the container.
# On Render's free plan, RENDER_EXTERNAL_URL is pinged every 4 minutes so the service
# never idles out (a sleeping provider agent would miss redemptions).
set -u
cd /app

IFS=',' read -ra procs <<< "${SERVICE:-agent}"
for p in "${procs[@]}"; do
  pnpm --filter @silica/services "$p" &
done

if [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  node -e 'const u = process.env.RENDER_EXTERNAL_URL + "/health"; setInterval(() => fetch(u).catch(() => {}), 240_000);' &
fi

wait -n
echo "a service process exited; stopping the container so it restarts" >&2
exit 1
