# ∿ DeskDoodle

**Draw on your desktop wallpaper. Keep the doodles.**

DeskDoodle opens an [Excalidraw](https://excalidraw.com) canvas on top of your current
wallpaper. Sketch whatever you like — a reminder, an arrow pointing at nothing, a cat —
hit `Ctrl+S`, and it becomes your desktop background. Your doodles stay editable, so the
next run you can move them, redraw them, or wipe them and start over.

https://user-images.githubusercontent.com/PLACEHOLDER/deskdoodle-demo.mp4

<!-- Replace the line above with the uploaded demo video. -->

> **This is an experiment, and mostly a toy.**
> I built it because drawing on my wallpaper sounded fun, not because anyone needed it.
> It works well on my machine, it will probably work on yours, and it is nobody's
> production software. Expect rough edges, and enjoy them.

## Install

```sh
npm install -g deskdoodle
```

Or run it without installing:

```sh
npx deskdoodle
```

## Use

```sh
deskdoodle          # open the editor on your wallpaper
deskdoodle erase    # delete the doodles, keep the wallpaper
deskdoodle restore  # put your original wallpaper back, keep the doodles
deskdoodle check    # check required tools and providers
```

`erase` and `restore` are opposites. `erase` throws the doodles away and leaves
DeskDoodle in charge of your background. `restore` hands your desktop back to the
wallpaper it had before DeskDoodle touched it, and keeps the doodles on disk — run
`deskdoodle` again and they are still there, ready to edit.

Inside the editor:

```text
Ctrl+S   save and close
Esc      close without saving
```

That is the whole tool.

## Requirements

- Linux with GNOME
- a wallpaper that is a local file (`file://...`)
- Node.js 22 or newer
- [ImageMagick](https://imagemagick.org) 7, for the `magick` command
- `gsettings` and `gdbus`, which GNOME already ships
- a browser to draw in: Firefox, Chromium/Chrome, or anything `xdg-open` picks

`deskdoodle check` tells you which of these are missing.

## How it works

1. Reads your current wallpaper and your monitor's resolution.
2. Scales the wallpaper to a base image and serves it to a local editor page.
3. You draw. The doodles are a transparent layer, exported at exactly your screen size.
4. ImageMagick composites the layer over the base image.
5. The result becomes your wallpaper.

Nothing leaves your machine. The editor is served on `127.0.0.1` behind a random token
and shuts down when you close it.

## Configuration

Saved in `~/.config/deskdoodle/config.json`.

```sh
deskdoodle config show
deskdoodle config set backend auto        # auto | gnome
deskdoodle config set browser firefox-kiosk
```

Browser launchers: `auto`, `firefox-kiosk`, `chromium-app`, `xdg-open`, `custom`.

A `custom` launcher takes an absolute path, so there is never any doubt about which
binary runs. Use `{url}` to place the editor URL, or leave it off to have it appended:

```sh
deskdoodle config set browser custom /usr/bin/brave --app={url}
```

## State

Everything lives in `~/.local/share/deskdoodle`:

| file | what it is |
| --- | --- |
| `state.json` | your original wallpaper, and how to restore it |
| `base.png` | that wallpaper, scaled to your monitor |
| `layer.excalidraw` | the doodle, still editable |
| `layer.png` | the doodle, rendered |
| `rendered.png` | what is actually on your desktop |

`state.json` holds the only thing DeskDoodle cannot rebuild: which wallpaper was yours
before it took over. Everything else is regenerated as needed — change your screen
resolution and the base image is re-rendered on the next run.

If you delete `state.json` while a doodled wallpaper is showing, DeskDoodle refuses to
start rather than mistake its own output for your original wallpaper. Set a real
wallpaper again first. `deskdoodle restore` keeps working even when every other file is gone.

## Limits

- GNOME only, for now — the wallpaper backend is a plug-in point, so more can follow
- primary monitor only
- local wallpaper files only

## Development

```sh
pnpm install
pnpm typecheck
pnpm build
pnpm start          # runs the built CLI

pnpm build && pnpm link --global    # use `deskdoodle` from this checkout
```
