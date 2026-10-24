#!/usr/bin/env bash
# Puts the shopper's secrets in the box's vault if they are not there yet. Run on a box or a test VM.
#   SHOPPER_CARD           Stripe's Visa test card (pm_card_visa, the PaymentMethod for 4242 4242 4242 4242). Test money only.
#   SHOPPER_AGENT_KEY      a new Ed25519 private key the box signs checkouts with (Visa Trusted Agent Protocol)
#   SHOPPER_MAIL_PASSWORD  a new random password for the demo inbox
# Add STRIPE_SECRET_KEY=sk_test_... by hand once the Stripe account exists. The store refuses a live key.
set -euo pipefail
[[ $(id -u) == 0 ]] || exec sudo "$0" "$@"
vault=${BOX_VAULT:-/etc/box/vault.env}
mkdir -p "$(dirname "$vault")"
touch "$vault"
chmod 600 "$vault"
add() { grep -q "^$1=." "$vault" || { echo "$1=$2" >>"$vault" && echo "added $1"; }; }
add SHOPPER_CARD pm_card_visa
add SHOPPER_AGENT_KEY "$(node -e "console.log(require('crypto').generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'))")"
add SHOPPER_MAIL_PASSWORD "$(openssl rand -hex 16)"
