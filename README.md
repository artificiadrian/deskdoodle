# DeskDoodle

GNOME-only wallpaper doodling prototype.

```sh
pnpm install
pnpm build
pnpm start
```

Commands:

```sh
node dist/cli/deskdoodle.js          # open editor
node dist/cli/deskdoodle.js --clear  # remove doodles and apply clean base
node dist/cli/deskdoodle.js --reset  # restore original GNOME wallpaper
```

Editor shortcuts:

```text
Ctrl+S  save, apply, close
Esc     discard, close
```

State lives in `~/.local/share/deskdoodle`.
