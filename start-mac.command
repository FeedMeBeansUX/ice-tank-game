#!/bin/bash
# Ice Tank Sumo: builds the game and starts the multiplayer server.
# Double-click this file (macOS). Keep the window open while you play; close it to stop.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js is not installed yet. Install the LTS version from https://nodejs.org"
  echo "and then double-click this file again."
  read -r -p "Press Enter to close."
  exit 1
fi
echo "Installing or updating what the game needs (first time can take a minute)..."
npm install --no-audit --no-fund || { read -r -p "Installing failed. Press Enter to close."; exit 1; }
npm start
