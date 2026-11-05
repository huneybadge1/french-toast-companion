// Password owns its bank and draw history independently of French Toast.
const PasswordData = (() => {
  const DECKS = ["basic", "advanced"];
  const PARTS = ["nouns", "verbs", "adjectives"];
  let bank = null;
  let loading = null;
  let decks = null;
  const piles = new Map();
  const lastWords = new Map();

  function validate(value) {
    const result = Object.create(null);
    const seen = new Set();
    for (const deck of DECKS) {
      result[deck] = [];
      for (const part of PARTS) {
        const words = value && value.decks && value.decks[deck] && value.decks[deck][part];
        if (!Array.isArray(words) || !words.length) throw new Error("Missing Password " + deck + " " + part + ".");
        for (const word of words) {
          if (typeof word !== "string" || !/^[a-z]+$/.test(word) || seen.has(word)) {
            throw new Error("Password words must be unique, lowercase single words.");
          }
          seen.add(word);
          result[deck].push(word);
        }
      }
    }
    return result;
  }

  async function load() {
    if (bank) return bank;
    if (loading) return loading;
    loading = (async () => {
      const response = await fetch("./password-words.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Password word bank failed to load (" + response.status + ").");
      const value = await response.json();
      decks = validate(value);
      bank = value;
      return bank;
    })();
    try { return await loading; }
    finally { loading = null; }
  }

  function shuffle(words) {
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
    return words;
  }

  function drawWord(deck) {
    if (!decks || !DECKS.includes(deck)) return "";
    let pile = piles.get(deck);
    if (!pile || !pile.length) {
      pile = shuffle(decks[deck].slice());
      // New cycles also avoid immediately repeating the last password.
      const last = pile.length - 1;
      if (last > 0 && pile[last] === lastWords.get(deck)) {
        [pile[0], pile[last]] = [pile[last], pile[0]];
      }
      piles.set(deck, pile);
    }
    const word = pile.pop();
    lastWords.set(deck, word);
    return word;
  }

  function counts() {
    return decks ? { basic: decks.basic.length, advanced: decks.advanced.length } : null;
  }

  return { load, drawWord, counts };
})();
