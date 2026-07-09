# DeskDoodle

Persistent wallpaper doodles for GNOME.

DeskDoodle opens an Excalidraw editor over your current wallpaper. When you save,
it exports your doodle layer, composites it over the wallpaper, and applies the
result as the new GNOME background.

## Requirements

- Linux with GNOME
- local file-based wallpaper, `file://...`
- Node.js 22 or newer
- pnpm
- GNOME command-line tools: `gsettings` and `gdbus`
- ImageMagick 7, with the `magick` command
- `firefox` or `xdg-open` to launch the editor

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
deskdoodle clear    # remove doodles and apply clean base
deskdoodle reset    # restore original GNOME wallpaper
```

## Editor Shortcuts

```text
Ctrl+S  save, apply, close
Esc     discard, close
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
