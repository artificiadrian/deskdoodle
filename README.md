# ∿ DeskDoodle

**Draw on your desktop wallpaper. Keep the doodles.**

DeskDoodle opens an [Excalidraw](https://excalidraw.com) canvas on top of your current wallpaper. Sketch whatever you like (a reminder, an arrow pointing at nothing, a cat) hit `Ctrl+S`, and it becomes your desktop background. Your doodles stay editable, so the next run you can move them, redraw them, or wipe them and start over.

_**DeskDoodle is still very experimental.** It only works with GNOME at the moment._

<video src="https://github.com/user-attachments/assets/47786bf6-cfc4-4a9b-b243-14cd7e6c1a69" controls preload></video>

## Install

```sh
npm install -g deskdoodle
```

Or run it without installing:

```sh
npx deskdoodle draw
```

## Use

```sh
deskdoodle draw     # open the canvas on your wallpaper
deskdoodle erase    # delete the doodles, keep the wallpaper
deskdoodle restore  # put your original wallpaper back, keep the doodles
deskdoodle check    # check required tools and providers
```

Run `deskdoodle` on its own for help.

`erase` and `restore` are opposites. `erase` throws the doodles away and leaves DeskDoodle in charge of your background. `restore` hands your desktop back to the wallpaper it had before DeskDoodle touched it, and keeps the doodles on disk — run `deskdoodle draw` again and they are still there, ready to edit.

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

A `custom` launcher takes an absolute path, so there is never any doubt about which binary runs. Use `{url}` to place the editor URL, or leave it off to have it appended:

```sh
deskdoodle config set browser custom /usr/bin/brave --app={url}
```

## Where things live

Your doodles and everything DeskDoodle renders sit in `~/.local/share/deskdoodle`. Only one thing in there cannot be rebuilt: the record of which wallpaper was yours before DeskDoodle took over. The rest is regenerated as needed — change your screen resolution
and the wallpaper is re-rendered on the next run.

Delete that record while a doodled wallpaper is showing, and DeskDoodle refuses to start rather than mistake its own output for your original wallpaper. Set a real wallpaper again first. `deskdoodle restore` keeps working even when everything else is gone.

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

## License

MIT
