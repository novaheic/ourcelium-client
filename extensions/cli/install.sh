#!/usr/bin/env sh
# Ourcelium CLI installer
#
#   curl -fsSL https://ourcelium.dev/install.sh | sh
#
# Installs the `ourcelium` command (and the `ourc` alias) globally via npm.
# The CLI is distributed on npm as @ourcelium/cli; this script just makes sure
# a recent enough Node.js is present and then runs the global install.

set -eu

PKG="@ourcelium/cli"
MIN_NODE_MAJOR=20

info() { printf '\033[36m%s\033[0m\n' "$1"; }
err()  { printf '\033[31m%s\033[0m\n' "$1" >&2; }

if ! command -v node >/dev/null 2>&1; then
  err "Node.js $MIN_NODE_MAJOR+ is required but was not found."
  err "Install Node.js from https://nodejs.org (or via your package manager), then re-run this script."
  exit 1
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  err "Node.js $MIN_NODE_MAJOR+ is required, but found $(node -v)."
  err "Please upgrade Node.js and re-run this script."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  err "npm was not found (it usually ships with Node.js). Please install npm and re-run."
  exit 1
fi

info "Installing $PKG globally..."
if npm install -g "$PKG"; then
  info "Ourcelium CLI installed. Run 'ourcelium login' to get started."
else
  err "Install failed. If you hit a permissions error, either use a Node version"
  err "manager (nvm, fnm) or re-run with sudo: sudo npm install -g $PKG"
  exit 1
fi
