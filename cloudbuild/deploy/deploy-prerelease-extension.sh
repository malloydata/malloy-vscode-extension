#!/usr/bin/env bash

set -euxo pipefail 

echo "Starting X"
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
export DISPLAY=:99

echo "Starting dbus"
service dbus start
export XDG_RUNTIME_DIR=/tmp/xdg_runtime
mkdir $XDG_RUNTIME_DIR
chmod 700 $XDG_RUNTIME_DIR
chown $(id -un):$(id -gn) $XDG_RUNTIME_DIR
export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
dbus-daemon --session --address=$DBUS_SESSION_BUS_ADDRESS --nofork --nopidfile --syslog-only &

echo "Installing npm packages"
npm ci --loglevel error
echo "Running integration tests" 
npm run integration
echo "Running unit tests"
npm run test

echo "Shutting down"
killall Xvfb
service dbus stop

npm run publish-extensions pre-release
