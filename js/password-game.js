// Untimed Password rules, independent of the DOM and French Toast's timer.
const PasswordGame = (() => {
  const TARGET = 15;
  const MAX_VALUE = 6;

  function create({ names, deck, firstTeam, drawWord }) {
    const history = [];
    let state = {
      names: names.slice(0, 2), deck, scores: [0, 0], wordNumber: 0,
      firstTeam: firstTeam === 1 ? 1 : 0,
      team: 0, value: MAX_VALUE, phase: "result", word: "", result: null, winner: null
    };
    const copy = (value) => JSON.parse(JSON.stringify(value));
    function remember() { history.push(copy(state)); }

    function nextWord() {
      if (state.phase !== "result") return false;
      const word = drawWord(state.deck);
      if (!word) throw new Error("The selected word deck is empty.");
      if (state.wordNumber) remember();
      state.wordNumber += 1;
      state.team = (state.firstTeam + state.wordNumber - 1) % 2;
      state.value = MAX_VALUE;
      state.word = word;
      state.result = null;
      state.winner = null;
      state.phase = "playing";
      return true;
    }

    function finish(kind, team, points) {
      if (team !== null) state.scores[team] += points;
      state.result = { kind, team, points };
      state.winner = state.scores.findIndex((score) => score >= TARGET);
      if (state.winner < 0) state.winner = null;
      state.phase = state.winner === null ? "result" : "won";
    }

    function record(action) {
      if (state.phase !== "playing" || !["correct", "wrong", "illegal", "said"].includes(action)) return false;
      remember();
      if (action === "correct") finish("correct", state.team, state.value);
      else if (action === "said") finish("said", 1 - state.team, 2);
      else if (state.value === 1) finish("exhausted", null, 0);
      else {
        state.value -= 1;
        state.team = 1 - state.team;
        state.result = { kind: action, team: 1 - state.team, points: 0 };
      }
      return true;
    }

    function undo() {
      if (!history.length) return false;
      state = history.pop();
      return true;
    }

    nextWord();
    return { record, nextWord, undo, getState: () => copy(state), canUndo: () => history.length > 0 };
  }
  return { create, TARGET, MAX_VALUE };
})();
