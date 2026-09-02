// Loads the bundled word/hint bank and deals from it without repeats
// within a single game. No network calls after the initial cached fetch.
const GameData = (() => {
  let bank = null;              // parsed french-toast-words.json
  let hintPile = [];            // shuffled hints not yet dealt this game
  const usedSecrets = new Set();

  async function load() {
    if (bank) return bank;
    const res = await fetch("./french-toast-words.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("word bank failed to load (" + res.status + ")");
    bank = await res.json();
    return bank;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Call at the start of every new game to reshuffle the hint pile.
  function resetForGame() {
    hintPile = shuffle(((bank && bank.hints) || []).slice());
  }

  // Draw a secret word from a deck ("basic" | "advanced"), avoiding any
  // word already used this session until the deck is exhausted.
  function drawSecret(deck) {
    const list = (bank && bank.secretWords && bank.secretWords[deck]) || [];
    if (!list.length) return "";
    const fresh = list.filter((w) => !usedSecrets.has(w.toLowerCase()));
    const pool = fresh.length ? fresh : list;
    const word = pool[Math.floor(Math.random() * pool.length)];
    usedSecrets.add(word.toLowerCase());
    return word;
  }

  // Deal two distinct hint adjectives for a round. Refills + reshuffles
  // if the pile runs low (only matters across many games without reload).
  function dealHints() {
    if (hintPile.length < 2) resetForGame();
    return [hintPile.pop(), hintPile.pop()];
  }

  // Put a dealt-but-not-used pair back (Toastmaster cancelled the deal).
  function returnHints(pair) {
    (pair || []).forEach((h) => { if (h) hintPile.push(h); });
    shuffle(hintPile);
  }

  function counts() {
    if (!bank) return null;
    return {
      basic: (bank.secretWords.basic || []).length,
      advanced: (bank.secretWords.advanced || []).length,
      hints: (bank.hints || []).length
    };
  }

  return { load, resetForGame, drawSecret, dealHints, returnHints, counts };
})();
