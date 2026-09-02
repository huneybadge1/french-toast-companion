# French Toast Companion — Project Notes

Offline-first PWA. A single shared phone/tablet on the table replaces the
physical bits of the indie word game *French Toast* (Jellybean Games): it
privately serves the Toastmaster a secret word, privately deals hint
adjectives, and shows the shared **Hint Scale**, the round **timer**, and
the **round count**. A human Toastmaster makes all "warmer / colder" calls
**out loud** — the app never tracks or judges guesses. **Cooperative mode
only.**

Plain HTML/CSS/JS, no build step, no framework, no backend. Deployed via
GitHub Pages, repo `huneybadge1/french-toast-companion` (remote `origin`).
**This is a separate project from Catchphrase (`Phrase-hot-potato`) — keep
them visually and aurally distinct.**

## House rules (differ from the retail game)

- **40-second** round timer (retail 30).
- **5 rounds** (retail 6).
- Each round the Toastmaster is dealt **2** hint adjectives, keeps **1**,
  discards the other (retail deals 6).
- **6-position** IS ↔ IS NOT scale; the game ends after the **5th** hint is
  placed, leaving one slot open.
- Custom-word option: the Toastmaster may type their own secret word.

## Deploy workflow (every change follows this)

1. Edit files.
2. Bump `js/version.js`'s `APP_VERSION` (`"v1"` → `"v2"` …) — the **single
   source of truth**. `sw.js` derives its cache name from it via
   `importScripts("./js/version.js")`; the on-screen badge (bottom-left)
   reads it directly. Never hardcode a separate cache string in `sw.js`.
3. Verify locally (`.claude/launch.json` runs `serve.ps1` on **:8090** — a
   hand-rolled PowerShell static server; this machine has no node/python).
   Use the Browser pane; clear SW + caches before testing
   (`caches.keys()…delete`, `serviceWorker.getRegistrations()…unregister()`)
   since it's a cache-first service worker.
4. `git add -A && git commit && git push` — Pages auto-deploys `main`. Poll
   the live `js/version.js` for the new version before telling the user
   it's done.
5. Tell the user to fully close and reopen the installed app once — it
   auto-reloads via the `controllerchange` listener in `app.js`, but only
   after the new SW finishes installing.

## Audio rule (important)

**Nothing sounds during a round** — the 40s countdown is visual only (timer
turns red + pulses under 10s). The only in-play sound is the **end-of-round
buzzer** in `js/audio.js`: a chopped, dissonant dual-tone (two detuned
square oscillators gated by a ~15 Hz square LFO, downward sag at the end).
It must **not** resemble the Catchphrase buzzer (a smooth descending
sawtooth siren). A short rising win flourish plays on "They got it!".
Synthesized with Web Audio — no bundled audio files. `unlock()` must run on
a real user gesture (first tap / Start) for iOS.

The user is often in a quiet space: when testing anything that could make
sound, monkey-patch the function to a no-op first
(`GameAudio.buzzer = function(){}`) before triggering the click.

## Visual identity (keep distinct from Catchphrase)

Warm syrup-gold (`--accent #e8a33d`) / cinnamon (`--accent-2 #c8622d`) /
berry palette on a warm espresso base. Rounded font stack (`ui-rounded`,
"SF Pro Rounded", …). Colourful "breakfast-sunrise" multi-radial gradient
on `body` (`background-attachment: fixed`). Custom toast-slice app icon
(regenerate with `scratchpad`-style System.Drawing PowerShell if needed).

## File map

- `index.html` — every screen in one file; `hidden` attribute toggles
  visibility (`.screen[hidden]{display:none}` overrides the flex display).
  Screens: setup, game (group display + Toastmaster controls together),
  win, loss. Overlays: `#peek-overlay` (shielded reveal), `#custom-overlay`
  (type your word), `#deal-overlay` (keep one of two hints).
- `css/style.css` — one file, CSS custom properties in `:root`.
- `js/version.js` — `APP_VERSION`, loaded first.
- `js/data.js` — `GameData`: loads `french-toast-words.json`, draws a secret
  word per game (no session repeats), deals 2 hints/round without repeats.
- `js/scale.js` — `HintScale`: 6-slot state, `place` / `lift` (never
  removes a placed hint), `placedCount`.
- `js/game.js` — `Game`: 5-round / 40s state machine, phases
  `deal → place → ready → running → won|lost`, timer that pauses
  preserving exact remaining time (portrait rotate + tab backgrounding).
- `js/app.js` — DOM wiring (IIFE, `els` caches refs by id). `pending` holds
  the hint "in hand"; tap an open slot to drop, tap a placed hint to lift.
  `fitChip()` scales hint text so long adjectives wrap instead of clipping.
  Registers the SW + `controllerchange` one-time reload. Two-tap Quit.
- `sw.js` — cache-first service worker, `importScripts` the version.
- `french-toast-words.json` — `secretWords.basic` / `secretWords.advanced`
  (single-noun words) + `hints` (versatile adjectives). Lowercase,
  alpha-sorted, deduped. Currently **315 / 315 / 150**. Keep it trivially
  appendable; dedupe case-insensitively within each list after any bulk
  add; re-validate that it parses and report counts.
- `manifest.json` — PWA manifest; relative paths so it works from the Pages
  subpath. `serve.ps1` / `.claude/launch.json` — local dev only, not
  deployed (`.claude/` is gitignored).

## Round flow

Deal hints → keep one (shielded panel) → place it on a scale slot (may also
move previously placed hints) → Start → 40s countdown → round ends on
**"They got it!"** (win, any round) or the buzzer (advance; after round 5 →
loss). First round only: a dismissible Toastmaster-side reminder to say
"French Toast" as the opening guess (not on the group display).

## Landscape / rotation

Landscape-first (the scale is horizontal). Portrait shows a "rotate" overlay
and pauses any running timer; `manifest.json` requests landscape but iOS
Safari ignores that, so the JS overlay + pause is the real handling.

## Known environment quirks

- No node/python. PowerShell (`System.*`) for any JSON / asset work.
- `Get-Content` / file writes: use `-Encoding UTF8` and
  `[System.Text.UTF8Encoding]::new($false)` (no BOM) to avoid mojibake.
- Cache-first SW: a stale-HTML + fresh-JS mismatch can happen mid-update —
  keep new optional UI null-guarded so a missing element never blocks core
  play.
