// Round + timer state machine. House rules: 5 rounds, 40-second timer,
// one hint placed per round, game ends after the 5th hint (or on a win).
const Game = (() => {
  const ROUNDS = 5;
  const ROUND_SECONDS = 40;

  let deck = "basic";
  let secretWord = "";
  let round = 1;
  // phase: "deal" -> "place" -> "ready" -> "running" -> ("won" | "lost")
  let phase = "deal";

  let intervalId = null;
  let endAt = 0;
  let remainingMs = ROUND_SECONDS * 1000;
  let paused = false;
  let tickCb = null;
  let endCb = null;

  function newGame(chosenDeck, word) {
    stopTimer();
    deck = chosenDeck;
    secretWord = word;
    round = 1;
    phase = "deal";
    remainingMs = ROUND_SECONDS * 1000;
  }

  function setPhase(p) { phase = p; }

  // Advance to the next round. Returns false (and sets phase "lost") when
  // the 5th round has just ended with no correct guess.
  function nextRound() {
    stopTimer();
    if (round >= ROUNDS) { phase = "lost"; return false; }
    round += 1;
    phase = "deal";
    remainingMs = ROUND_SECONDS * 1000;
    return true;
  }

  function startTimer(onTick, onEnd) {
    stopTimer();
    tickCb = onTick;
    endCb = onEnd;
    phase = "running";
    paused = false;
    remainingMs = ROUND_SECONDS * 1000;
    endAt = Date.now() + remainingMs;
    onTick(Math.ceil(remainingMs / 1000));
    intervalId = setInterval(loop, 200);
  }

  function loop() {
    if (paused) return;
    const left = endAt - Date.now();
    if (left <= 0) {
      stopTimer();
      if (tickCb) tickCb(0);
      if (endCb) endCb();
      return;
    }
    if (tickCb) tickCb(Math.ceil(left / 1000));
  }

  // Pause/resume preserve the exact remaining time (used for the portrait
  // rotate overlay and for backgrounding the tab).
  function pause() {
    if (phase !== "running" || paused) return;
    paused = true;
    remainingMs = Math.max(0, endAt - Date.now());
    clearInterval(intervalId);
    intervalId = null;
  }

  function resume() {
    if (phase !== "running" || !paused) return;
    paused = false;
    endAt = Date.now() + remainingMs;
    intervalId = setInterval(loop, 200);
  }

  function stopTimer() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    paused = false;
  }

  function win() { stopTimer(); phase = "won"; }

  return {
    ROUNDS, ROUND_SECONDS,
    newGame, setPhase, nextRound, startTimer, pause, resume, stopTimer, win,
    getRound: () => round,
    getPhase: () => phase,
    getDeck: () => deck,
    getSecretWord: () => secretWord
  };
})();
