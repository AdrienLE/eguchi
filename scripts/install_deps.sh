#!/usr/bin/env bash
set -e

# Install Yarn if it's missing
if ! command -v yarn >/dev/null 2>&1; then
  npm install -g yarn
fi

# Install Python dependencies
pip install -r requirements.txt

# Install JS dependencies (skip native builds)
(cd frontend && yarn install --mode=skip-build)
