#!/usr/bin/env bash
# Build and (re)start the site in Docker.
# The build checks the code and every test first and stops if anything is broken.
#   ./deploy.sh                 -> http://localhost:10370
#   IELTS_PORT=8080 ./deploy.sh -> http://localhost:8080
set -euo pipefail
cd "$(dirname "$0")"

docker compose up -d --build
echo
echo "IELTS Listening Practice is running at http://localhost:${IELTS_PORT:-10370}"
echo "Stop it with: docker compose down"
