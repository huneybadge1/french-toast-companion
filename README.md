# French Toast Companion

An offline-first PWA that replaces the physical components of the word game
*French Toast* (Jellybean Games) for personal use. One shared phone or
tablet sits on the table; a human **Toastmaster** runs the round and makes
every "warmer / colder" call out loud. The app just holds the pieces:

- privately serves the Toastmaster a **secret word** (Basic / Advanced
  deck, or type your own)
- privately **deals two hint adjectives** each round; the Toastmaster keeps
  one and places it on the scale
- shows the shared **Hint Scale** (a 6-slot IS ↔ IS NOT spectrum), the
  **40-second timer**, and the **round count**

Cooperative mode only. House rules: 5 rounds, 40-second timer, 2 hints
dealt per round, the game ends after the 5th hint is placed.

## Play / install

Open the Pages URL in a phone browser, held in **landscape**, and add it to
your home screen. It's fully offline after the first load — no network
calls during play.

## Local development

No build step. A tiny PowerShell static server is included (this machine
has no node/python):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Then open <http://localhost:8090> in landscape. It's a cache-first service
worker, so hard-reload / clear site data after edits.

Bump `APP_VERSION` in `js/version.js` on every change — it's the single
source of truth for the on-screen version badge and the service-worker
cache name.

## Word bank

`french-toast-words.json` — `secretWords.basic`, `secretWords.advanced`
(single-noun secret words) and `hints` (versatile adjectives). Original
lists, not copied from the retail game. Plain sorted arrays, trivially
appendable.
