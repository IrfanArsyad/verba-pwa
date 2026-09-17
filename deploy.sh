#!/usr/bin/env bash
# VerbaAI PWA — build ulang image dan jalankan (ulang) stack docker compose.
#
# Pemakaian:
#   ./deploy.sh              build ulang web + up -d
#   ./deploy.sh --pull       git pull --rebase dulu sebelum build
#   ./deploy.sh --no-cache   build tanpa cache docker
#   ./deploy.sh --logs       ikuti log setelah stack jalan
#   ./deploy.sh --down       matikan stack lalu keluar

set -euo pipefail

cd "$(dirname "$0")"

PULL=0
NO_CACHE=()
LOGS=0

for arg in "$@"; do
  case "$arg" in
    --pull) PULL=1 ;;
    --no-cache) NO_CACHE=(--no-cache) ;;
    --logs) LOGS=1 ;;
    --down)
      docker compose down
      exit 0
      ;;
    -h|--help)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Opsi tidak dikenal: $arg (lihat --help)" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f deploy/cloudflared/credentials.json ]]; then
  echo "deploy/cloudflared/credentials.json tidak ada; tunnel tidak akan bisa jalan." >&2
  exit 1
fi

if (( PULL )); then
  echo "==> git pull"
  git pull --rebase
fi

echo "==> build image web"
BUILD_ID="$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo local)"
echo "    BUILD_ID=$BUILD_ID"
docker compose build "${NO_CACHE[@]}" --build-arg "BUILD_ID=$BUILD_ID" web

echo "==> jalankan stack"
docker compose up -d --remove-orphans

echo "==> tunggu healthcheck"
healthy=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8130/healthz >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 1
done

if (( healthy )); then
  echo "web sehat: http://127.0.0.1:8130"
else
  echo "web tidak merespons dalam 30 detik. Log terakhir:" >&2
  docker compose logs --tail=50 web >&2
  exit 1
fi

docker image prune -f >/dev/null
docker compose ps

if (( LOGS )); then
  docker compose logs -f
fi
