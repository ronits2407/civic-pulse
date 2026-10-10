#!/bin/sh
# Checks which redirect URLs your Supabase project will actually honour for sign-in.
#
# Why this exists: when a redirect URL is NOT in Supabase's allow-list, Supabase
# silently ignores it and sends the browser to the project's Site URL instead
# (http://localhost:3000 in development). The app never gets control back, and nothing
# in the app can detect it. This script asks Supabase directly.
#
# It calls /auth/v1/verify with a deliberately invalid token, so no email is sent and
# nothing is created or changed. Supabase validates redirect_to before it answers.
#
# Usage:
#   sh scripts/check-auth-redirect.sh                      # checks the usual candidates
#   sh scripts/check-auth-redirect.sh 'exp://192.168.1.5:8081/--/auth-callback'

cd "$(dirname "$0")/.." || exit 1

URL=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '\r"')
if [ -z "$URL" ]; then
  echo "EXPO_PUBLIC_SUPABASE_URL not found in mobile/.env.local" >&2
  exit 1
fi

check_one() {
  asked="$1"
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$asked")
  loc=$(curl -s -D - -o /dev/null --max-time 25 \
    "$URL/auth/v1/verify?token=redirect-probe-not-a-real-token&type=magiclink&redirect_to=$enc" \
    | grep -i '^location:' | head -1 | cut -c11- | tr -d '\r')

  if [ -z "$loc" ]; then
    echo "?  NO ANSWER      $asked   (network timeout - try again or switch network)"
  elif [ "${loc#"$asked"}" != "$loc" ]; then
    echo "OK ACCEPTED       $asked"
  else
    echo "XX REJECTED       $asked   -> falls back to ${loc%%#*}"
  fi
}

if [ "$#" -gt 0 ]; then
  for u in "$@"; do check_one "$u"; done
else
  LAN=$(ipconfig getifaddr en0 2>/dev/null)
  set -- \
    'exp://127.0.0.1:8081/--/auth-callback' \
    'exp://10.0.2.2:8081/--/auth-callback' \
    "exp://${LAN:-192.168.1.2}:8081/--/auth-callback" \
    'civicpulse://auth-callback'
  for u in "$@"; do check_one "$u" & done
  wait
fi
