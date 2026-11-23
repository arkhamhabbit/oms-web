#!/bin/sh
# Runs at every container start (nginx image's /docker-entrypoint.d). Writes the page's runtime
# settings (/config.js) and the Content-Security-Policy from the environment. Values that are
# not plain addresses are never put into the policy or into a script.
set -eu

HTML="${OMS_HTML_DIR:-/usr/share/nginx/html}"
CSP="${OMS_CSP_FILE:-/etc/nginx/oms/csp.conf}"

api="${OMS_API_BASE_URL:-}"
media="${MEDIA_ORIGIN:-}"

# A bare origin: scheme, host, optional port, optional trailing slash.
origin_re='^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$'
# Characters that are safe inside a JSON string written into config.js.
plain_re='^[A-Za-z0-9:/._@?#=&%~+-]*$'

json_value() {
  # prints a JSON string, or null when empty; an unreadable value is replaced, never echoed
  if [ -z "$1" ]; then
    printf 'null'
  elif printf '%s' "$1" | grep -Eq "$plain_re"; then
    printf '"%s"' "$1"
  else
    printf '"(unreadable value)"'
  fi
}

printf 'window.__OMS_CONFIG__ = { apiBaseUrl: %s, mediaOrigin: %s };\n' \
  "$(json_value "$api")" "$(json_value "$media")" > "$HTML/config.js"

api_src=""
if [ -n "$api" ]; then
  if printf '%s' "$api" | grep -Eq "$origin_re"; then
    api_src="${api%/}"
  else
    echo "oms-web: OMS_API_BASE_URL is not a plain http(s) address; the console will show a configuration page" >&2
  fi
else
  echo "oms-web: OMS_API_BASE_URL is not set; the console will show a configuration page" >&2
fi

media_src=""
if [ -n "$media" ]; then
  if printf '%s' "$media" | grep -Eq "$origin_re"; then
    media_src="${media%/}"
  else
    echo "oms-web: MEDIA_ORIGIN is not a plain http(s) address; images are limited to the console's own address" >&2
  fi
else
  echo "oms-web: MEDIA_ORIGIN is not set; images are limited to the console's own address" >&2
fi

# default-src none; scripts, fonts and the manifest only from the console itself.
# style-src 'unsafe-inline': the UI libraries set style attributes at run time.
# img-src: own origin, data:, blob: (previews of a chosen file) and the media origin.
# connect-src: own origin, the OMS, and the media origin (signed uploads are PUT straight to storage).
# object-src/frame-src blob:: a shipping label is opened as a blob in a new tab.
policy="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: $media_src; connect-src 'self' $api_src $media_src; object-src blob:; frame-src blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
policy=$(printf '%s' "$policy" | tr -s ' ' | sed 's/ ;/;/g')

printf 'add_header Content-Security-Policy "%s" always;\n' "$policy" > "$CSP"
echo "oms-web: runtime settings written (api: ${api_src:-none}, media: ${media_src:-none})"
