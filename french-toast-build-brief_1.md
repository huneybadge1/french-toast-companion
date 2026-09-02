# French Toast Companion App — Build Brief

Paste this as your first message to Claude Code. Drop `french-toast-words.json`
into the project folder so the app has seed data to expand.

## Overview

Build an **offline-first Progressive Web App (PWA)** that replaces the physical
components of the indie word game *French Toast* (Jellybean Games), for personal
use. A single shared phone/tablet sits on the table. A human plays **Toastmaster**
and makes all the "closer / warmer" judgments **verbally** — the app does NOT
track or judge guesses. The app only replaces the physical bits: it privately
serves the Toastmaster a secret word (or lets them enter their own), privately
deals hint adjectives, and displays the shared **Hint Scale**, the round
**timer**, and the **round count**. **Cooperative mode only** for this version.

## House rules (differences from the retail game)

* **40-second** round timer (retail is 30).
* **5 rounds** (retail is 6).
* Each round the Toastmaster is dealt **2** hint adjectives to choose from (retail
deals 6), picks 1, and discards the other.
* Keep the **6-position** IS ↔ IS NOT scale; the game ends after the **5th hint**
is placed, leaving one slot open.
* A **custom word** option: the Toastmaster may enter their own secret word
instead of drawing one.

## Platform \& tech

* Offline-first PWA: installable to the home screen, service-worker cached, fully
functional in airplane mode. **No backend, no network calls during play.**
* **Single shared device** (phone or tablet) on the table.
* **Landscape-first** (the scale is horizontal). Detect portrait and show a
"rotate your phone" overlay; do not force an orientation lock (iOS Safari can't).
* Synthesize the timer buzzer with the **Web Audio API** (no audio files); unlock
audio on the first user tap. Fire the Vibration API where supported (Android);
no-op elsewhere.
* Keep the footprint minimal.

## What's on screen

It's one shared screen, so keep the **group-facing display minimal** and put the
Toastmaster's controls on the same screen.

* **Group-facing (always visible):** the Hint Scale, the countdown timer, and the
round number (e.g. "Round 2 of 5"). **Nothing else** — no guess tracking, no
closest-guess text. (The closest guess is spoken aloud by the Toastmaster, as in
the tabletop game.)
* **Toastmaster controls (same screen):** peek secret word, deal / select / place
hints, move placed hints, start timer, "They got it!" (win), advance round.

## Private info handling (single shared screen)

Two things must stay hidden from the group, via a **shielded reveal** the
Toastmaster briefly covers:

* **Secret Word:** a "Peek" control reveals it momentarily (tap-and-hold, or
tap-to-reveal-then-auto-hide), available at any time. For a custom word, the same
shielded panel is used to type it in privately at setup.
* **Hint options:** when dealing, the **2** drawn adjectives appear in a private
panel; once the Toastmaster taps one to keep, the panel closes and only the
chosen hint is placed **on the on-screen Hint Scale, shown to the whole table**.

## The Hint Scale (the centerpiece — this is the whole reason for the app)

* A horizontal spectrum with **6 slots**, labeled **"IS"** at one end and
**"IS NOT"** at the other, with gradations between.
* Each round the Toastmaster places exactly **one** chosen adjective under one
slot **on the phone's scale**; its position shows how well that adjective
describes the secret word, and it stays on screen for everyone to see.
* **At most one hint per slot.** When placing a new hint, the Toastmaster may move
any already-placed hints to other slots (each must end under a different slot).
* Placed hints stay visible for the rest of the game — they can be moved but never
removed.
* Make this display clean, legible, and prominent. It's the shared visual the
whole app exists to provide.

## Round flow (5 rounds)

1. Toastmaster taps **Deal hints** → the app privately shows **2** random
adjectives from the hint pool (drawn without repeating within a game).
2. Toastmaster taps one to **select** (app discards the other), then **places** it
in a scale slot on the phone, where it's shown to the whole group; may also move
previously placed hints.
3. Toastmaster taps **Start** → the 40-second countdown begins (visible to the
group).

   * *(First round only: an optional Toastmaster-side reminder to announce
"French Toast" as the starting closest guess. Not shown on the group display.)*
4. Guessing happens **verbally**; the Toastmaster responds aloud per the game's
rules. The app does not track or judge guesses.
5. The round ends when either:

   * the Toastmaster taps **"They got it!"** → immediate **win** screen (any
round), or
   * the timer reaches zero → buzzer, and the app advances to the next round.
6. After the 5th round with no correct guess → **loss** screen.

## Setup

* Choose one of: **Basic** deck, **Advanced** deck, or **Enter your own word**.

  * Basic / Advanced: the app privately assigns the Toastmaster a secret word from
that list.
  * Enter your own word: the Toastmaster privately types a custom secret word (a
single-word noun works best, but don't hard-enforce it) via the shielded
panel. It's then used exactly like a drawn word — peekable at any time.
* Cooperative only; no team mode in this version.

## Word \& hint database

* Bundled local JSON (`french-toast-words.json`) with `secretWords.basic`,
`secretWords.advanced`, and `hints`.
* Secret words are **single-word nouns**. Basic = everyday, concrete, easy;
Advanced = trickier, more abstract or less common, but still a guessable single
noun. Hints are **versatile adjectives** that can describe many different nouns.
* These are **original lists** (not copied from the retail game). **Expand the
seed autonomously, with minimal input from me:**

  * Basic secret words → \~300; Advanced → \~300.
  * Hints → \~150 versatile adjectives.
  * De-duplicate case-insensitively within each list; keep secret words to single
nouns and hints to broadly-applicable adjectives.
  * Validate that the JSON parses and report the final counts.

## Ongoing refresh

* Keep the JSON trivially appendable so new words and adjectives can be added later.

## Suggested build order

1. Scaffold the offline PWA (manifest, service worker, installable).
2. The Hint Scale display (6-slot IS ↔ IS NOT spectrum) + placing and moving hints.
3. Private secret-word peek, custom-word entry, and hint dealing/selection with the
shielded reveal.
4. Round timer (40s countdown + Web Audio buzzer) + round tracking (end after 5).
5. Win / loss screens ("They got it!" and the end-of-round-5 loss).
6. Basic / Advanced / custom-word setup; wire in the word/hint data and expand the
lists.
7. Landscape/rotate handling, vibration, polish; then show me how to preview it
locally and install it on my phone.

