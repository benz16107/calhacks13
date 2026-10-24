#!/bin/sh
# One-command install of the GurtOS wallet as an MCP server (Solana devnet, test money).
#   curl -fsSL https://raw.githubusercontent.com/benz16107/calhacks13/main/tracks/wallet/install.sh | sh
# Safe to run again: it updates the code, keeps your key, and re-registers the server.
# Settings (environment): WALLET_HOME (default ~/.gurtos-wallet), WALLET_BUDGET_CENTS (10), WALLET_HOSTS (none),
# GURTOS_WALLET_SRC (a local checkout to use instead of cloning, for testing).
set -eu

REPO=${GURTOS_REPO:-https://github.com/benz16107/calhacks13.git}
HOME_DIR=${WALLET_HOME:-$HOME/.gurtos-wallet}
BUDGET=${WALLET_BUDGET_CENTS:-10}
HOSTS=${WALLET_HOSTS:-}
APP=$HOME_DIR/app
KEY=$HOME_DIR/key

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v node >/dev/null || { echo "Node 22.18 or newer is required" >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a==22&&b>=18)?0:1)' ||
  { echo "Node 22.18 or newer is required (this is $(node -v))" >&2; exit 1; }

umask 077
mkdir -p "$HOME_DIR"

# Only tracks/wallet is needed: the imports from core/ are types, which Node erases.
if [ -n "${GURTOS_WALLET_SRC:-}" ]; then
  rm -rf "$APP/tracks/wallet"; mkdir -p "$APP/tracks"
  (cd "$GURTOS_WALLET_SRC/tracks" && tar --exclude=node_modules -cf - wallet) | (cd "$APP/tracks" && tar -xf -)
else
  rm -rf "$APP"
  git clone --quiet --depth 1 --branch "${GURTOS_REF:-main}" --filter=blob:none --sparse "$REPO" "$APP"
  git -C "$APP" sparse-checkout set tracks/wallet
fi
cd "$APP/tracks/wallet"
npm install --omit=dev --workspaces=false --no-audit --no-fund --loglevel=error

if [ ! -f "$KEY" ]; then
  node --experimental-strip-types --disable-warning=ExperimentalWarning keygen.ts 2>/dev/null | sed 's/^WALLET_SOLANA_KEY=//' >"$KEY"
  chmod 600 "$KEY"
  echo "Made a new devnet wallet key in $KEY"
fi
ADDRESS=$(node --experimental-strip-types --disable-warning=ExperimentalWarning --input-type=module -e '
import fs from "node:fs";
import { createKeyPairSignerFromBytes, getBase58Encoder } from "@solana/kit";
const k = fs.readFileSync(process.argv[1], "utf8").trim();
console.log((await createKeyPairSignerFromBytes(getBase58Encoder().encode(k))).address);' "$KEY")

SERVER=$APP/tracks/wallet/mcp.ts
# The config carries the key's path, never the key.
ARGS="--experimental-strip-types --disable-warning=ExperimentalWarning $SERVER"

echo
echo "Wallet address (Solana devnet, test money): $ADDRESS"
echo "Fund it with devnet USDC: open https://faucet.circle.com, choose Solana, USDC, network Solana Devnet, paste the address."
echo "Explorer: https://explorer.solana.com/address/$ADDRESS?cluster=devnet"
echo

registered=
if command -v claude >/dev/null; then
  claude mcp remove gurtos-wallet --scope user >/dev/null 2>&1 || true
  # shellcheck disable=SC2086
  claude mcp add gurtos-wallet --scope user \
    -e WALLET_KEY_FILE="$KEY" -e WALLET_HOME="$HOME_DIR" -e WALLET_BUDGET_CENTS="$BUDGET" -e WALLET_HOSTS="$HOSTS" \
    -- node $ARGS >/dev/null && { echo "Registered with Claude Code (claude mcp list)."; registered=1; }
fi
if command -v droid >/dev/null; then
  droid mcp remove gurtos-wallet >/dev/null 2>&1 || true
  droid mcp add gurtos-wallet "node $ARGS" \
    --env WALLET_KEY_FILE="$KEY" --env WALLET_HOME="$HOME_DIR" --env WALLET_BUDGET_CENTS="$BUDGET" --env WALLET_HOSTS="$HOSTS" \
    >/dev/null && { echo "Registered with Factory Droid (droid mcp list)."; registered=1; }
fi

echo
echo "Budget: $BUDGET cents without asking. Allowed hosts: ${HOSTS:-none yet}."
echo "To change them, run this installer again with WALLET_BUDGET_CENTS=50 WALLET_HOSTS=api.example.com set."
if [ -z "$registered" ]; then
  echo "For any other MCP client, add this server:"
  cat <<JSON
{ "mcpServers": { "gurtos-wallet": {
  "command": "node",
  "args": ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "$SERVER"],
  "env": { "WALLET_KEY_FILE": "$KEY", "WALLET_HOME": "$HOME_DIR", "WALLET_BUDGET_CENTS": "$BUDGET", "WALLET_HOSTS": "$HOSTS" } } } }
JSON
fi
