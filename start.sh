#!/bin/bash
set -euo pipefail

cd /opt/fundm
editor_pid=
backend_pid=

cleanup() {
    if [ -n "$editor_pid" ]; then kill "$editor_pid" 2>/dev/null || true; fi
    if [ -n "$backend_pid" ]; then kill "$backend_pid" 2>/dev/null || true; fi
    wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

elm reactor --port=8000 &
editor_pid=$!

cd experiment/backend
node server.js &
backend_pid=$!

wait -n "$editor_pid" "$backend_pid"
