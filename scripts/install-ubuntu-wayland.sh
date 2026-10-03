#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/tracky-mouse-f9/"
KEY_SCHEMA="org.gnome.settings-daemon.plugins.media-keys.custom-keybinding"

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
ok()  { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "${XDG_SESSION_TYPE:-}" != "wayland" && -z "${WAYLAND_DISPLAY:-}" ]]; then
	printf '\033[1;33m!\033[0m This installer is intended for a GNOME Wayland session.\n' >&2
fi

for command in node npm go python3 gsettings; do
	command -v "$command" >/dev/null 2>&1 || die "$command is required but was not found."
done

go_version="$(go env GOVERSION | sed 's/^go//')"
if ! printf '%s\n%s\n' "1.25.0" "$go_version" | sort -V -C; then
	die "Go >= 1.25 is required; found $go_version."
fi

log "Installing Ubuntu Wayland portal dependencies"
sudo apt-get update
sudo apt-get install -y xdg-desktop-portal xdg-desktop-portal-gnome desktop-file-utils

log "Installing Tracky Mouse dependencies (Electron stays at the repo's 31.7.x line)"
cd "$ROOT"
npm run install-all

log "Resolving RobotGo v1.1.0 dependencies"
cd "$ROOT/desktop-app/tm-driver"
go mod tidy

log "Building the libei mouse driver"
CGO_ENABLED=0 go build -tags libei -o bin/tracky-mouse-driver .

mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.cache"

LAUNCHER="$HOME/.local/bin/tracky-mouse-wayland"
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
set -e
cd "$ROOT/desktop-app"
exec npm start
EOF
chmod +x "$LAUNCHER"

TOGGLE="$HOME/.local/bin/tracky-mouse-toggle"
cat > "$TOGGLE" <<EOF
#!/usr/bin/env bash
set -euo pipefail
ROOT="$ROOT"

pid=""
while read -r candidate; do
	[[ -n "\$candidate" ]] || continue
	[[ -r "/proc/\$candidate/cmdline" ]] || continue
	cmd="\$(tr '\0' ' ' < "/proc/\$candidate/cmdline")"
	if [[ "\$cmd" == *"\$ROOT/desktop-app/node_modules/electron/dist/electron"* ]] &&
	   [[ "\$cmd" != *"--type="* ]]; then
		pid="\$candidate"
		break
	fi
done < <(pgrep -u "\$UID" -f "\$ROOT/desktop-app/node_modules/electron/dist/electron" || true)

if [[ -n "\$pid" ]]; then
	kill -USR1 "\$pid"
fi
EOF
chmod +x "$TOGGLE"

log "Registering F9 as a GNOME-global shortcut"
python3 - "$KEY_PATH" <<'PY'
import ast
import subprocess
import sys

path = sys.argv[1]
schema = "org.gnome.settings-daemon.plugins.media-keys"
key = "custom-keybindings"
raw = subprocess.check_output(["gsettings", "get", schema, key], text=True).strip()
try:
    bindings = ast.literal_eval(raw)
except Exception:
    bindings = []
if path not in bindings:
    bindings.append(path)
value = "[" + ", ".join(repr(item) for item in bindings) + "]"
subprocess.check_call(["gsettings", "set", schema, key, value])
PY

gsettings set "$KEY_SCHEMA:$KEY_PATH" name "'Tracky Mouse Toggle'"
gsettings set "$KEY_SCHEMA:$KEY_PATH" command "'$TOGGLE'"
gsettings set "$KEY_SCHEMA:$KEY_PATH" binding "'F9'"

DESKTOP_FILE="$HOME/.local/share/applications/io.isaiahodhner.TrackyMouse.desktop"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Tracky Mouse
GenericName=Facial Mouse
Comment=Hands-free mouse control
Exec=$LAUNCHER
Icon=$ROOT/images/tracky-mouse-logo-512.png
Terminal=false
Categories=Utility;Accessibility;
StartupNotify=true
EOF
update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true

systemctl --user start xdg-desktop-portal.service >/dev/null 2>&1 || true
systemctl --user start xdg-desktop-portal-gnome.service >/dev/null 2>&1 || true

log "Restarting Tracky Mouse"
pkill -u "$UID" -f "$ROOT/desktop-app/node_modules/electron/dist/electron" >/dev/null 2>&1 || true
sleep 1
nohup "$LAUNCHER" >"$HOME/.cache/tracky-mouse-wayland.log" 2>&1 &

ok "Installed. F9 is global through GNOME; mouse input uses RobotGo/libei."
printf 'Log: %s\n' "$HOME/.cache/tracky-mouse-wayland.log"
