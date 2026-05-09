# Brand fonts

Drop the production .woff2 files into this folder, then uncomment the
`localFont` blocks in `app/layout.tsx` and remove the `*Fallback` references.

## Expected files

### Display — Editor's Note (Production Type)

- `EditorsNote-Regular.woff2`
- `EditorsNote-Italic.woff2`
- `EditorsNote-Semibold.woff2`

### Body — Sequel Sans Display (Hello Type)

- `SequelSansDisplay-Regular.woff2`
- `SequelSansDisplay-Medium.woff2`
- `SequelSansDisplay-Semibold.woff2`

## Switchover

In `app/layout.tsx`:

1. Uncomment the `display` and `body` `localFont` blocks.
2. Replace the `displayFallback.variable` / `bodyFallback.variable` references
   in the `<html>` className with `display.variable` / `body.variable`.
3. Remove the `Instrument_Serif` and `Geist` imports + their fallback
   constants (kept right now so the portal builds without these files).

The CSS variables `--font-display` / `--font-body` stay the same, so nothing
else in the codebase has to change.

## Note

These files are paid licenses — never commit the .woff2 files to a public
repo. They're gitignored by the rule `public/brand/fonts/*.woff2` (add this
if it isn't there already).
