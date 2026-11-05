# Word Night

Two in-person word games in one offline-first app. Open Word Night on a
shared phone or tablet, choose a game, and play aloud with friends.

## Games

### French Toast

A Toastmaster companion for *French Toast* (Jellybean Games). The app
privately serves a secret word and deals two hint adjectives each round;
the Toastmaster keeps one and places it on the six-position IS ↔ IS NOT
scale. The group guesses aloud while the Toastmaster calls warmer/colder.

House rules: cooperative play, five rounds, 40 seconds per round, and
multiple hints allowed at the same scale position. Basic, Advanced, and
custom secret words are available. Optional two-screen mode spans the
scale across two phones on the same Wi-Fi or hotspot. Hold the device in
landscape for French Toast.

### Password

Two teams give one-word clues to their teammates. Both clue-givers
privately view the same password with a hold-to-reveal button. The active
team gets one clue and one guess per turn; players judge the spoken clues
and guesses and record the outcome on the shared phone.

- First team to **15 or more points** wins; turns are **untimed**.
- A word starts at **6 points**. Wrong guesses and illegal clues forfeit
  the turn, pass play to the opposing team, and lower the value by one.
- After six unsuccessful turns (6, 5, 4, 3, 2, 1), the word ends without
  points and the answer is revealed.
- Saying the password ends that word and gives the **opponents 2 points**.
- The starting team alternates each new word. Both teams swap clue-giver
  and guesser between words. Choose the initial team or randomize it.
- Undo reverses the last turn, award, or word transition, including a win.

Password uses the Basic or Advanced word deck and supports either screen
orientation. Scores and game progress last for the current page session.

## Play / install

Open <https://huneybadge1.github.io/french-toast-companion/> and add it to
your home screen. Both games work offline after the first load completes.
The existing address and installation are retained; the app is now named
**Word Night**. Fully close and reopen an installed copy after an update.
Some devices may retain the old home-screen label until it is re-added.

## Local development

Plain HTML/CSS/JS; no build step, framework, backend, or external assets.
Serve this directory with any static server, for example:

```sh
python -m http.server 8090
```

A PowerShell server is also included:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Open <http://localhost:8090>. The service worker is cache-first, so clear
its registration and caches when verifying local edits. Bump
`APP_VERSION` in `js/version.js` on every deployment; the badge and service
worker cache derive their version from that file. GitHub Pages serves
`main`.

## Checks

Password's scoring and state transitions have no dependencies:

```sh
node --test tests/password-game.test.cjs
```

When testing French Toast, silence `GameAudio.buzzer` and `GameAudio.win`
before triggering sound in a quiet environment. Verify a complete round,
the Password penalties and privacy reveal, and offline play after edits.

## Word bank

`french-toast-words.json` contains `secretWords.basic`,
`secretWords.advanced` (single-noun words), and `hints` (adjectives).
Original lists, not copied from the retail game. Both games draw from the
shared word decks, avoiding session repeats until a deck is exhausted.
The sorted arrays are easy to extend.
