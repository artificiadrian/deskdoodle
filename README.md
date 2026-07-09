# DeskDoodle

Persistent wallpaper doodles.

DeskDoodle opens an Excalidraw editor over your current wallpaper. When you save,
it exports your doodle layer, composites it over the wallpaper, and applies the
result as the new desktop background.

## Requirements

- Linux with a supported wallpaper provider
- local file-based wallpaper, `file://...`
- Node.js 22 or newer
- pnpm
- ImageMagick 7 with the `magick` command
- for the GNOME provider: `gsettings` and `gdbus`
- a supported browser launcher: Firefox, Chromium/Chrome, or `xdg-open`

```sh
pnpm install
pnpm build
pnpm start
```

## Install Locally

To install the `deskdoodle` command globally for your user from this checkout:

```sh
pnpm run link:global
```

## Commands

```sh
deskdoodle          # open editor
deskdoodle clear    # remove saved doodles
deskdoodle reset    # restore original wallpaper
deskdoodle check    # check providers and required tools
deskdoodle config show
deskdoodle config set backend auto
deskdoodle config set browser firefox-kiosk
```

Provider config lives in `~/.config/deskdoodle/config.json`.

Supported wallpaper backends:

- `auto`
- `gnome`

Supported browser launchers:

- `auto`
- `firefox-kiosk`
- `chromium-app`
- `xdg-open`
- `custom`, for example:

```sh
deskdoodle config set browser custom brave --app={url}
```

## Editor Shortcuts

```text
Ctrl+S  save and close
Esc     close without saving
```

## State

State lives in `~/.local/share/deskdoodle`.

DeskDoodle keeps the editable Excalidraw scene separate from the rendered
wallpaper image, so later runs can move, delete, or edit previous doodles.

## Current Limits

- GNOME only
- primary monitor only
- local wallpaper files only
- uses GNOME's current wallpaper as the base image when first initialized
- no packaged npm release yet
