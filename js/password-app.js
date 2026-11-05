(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let match = null;
  let busyUntil = 0;
  let armTimer = null;
  let revealTimer = null;
  let quitTimer = null;
  let quitArmed = false;
  let wakeLock = null;
  let wakePending = false;
  const actionButtons = ["pw-correct", "pw-wrong", "pw-illegal", "pw-said", "pw-next", "pw-again", "pw-undo"];
  $("version-badge").textContent = APP_VERSION;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((reg) => reg.update()).catch(() => {});
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  GameData.load().then(() => {
    const counts = GameData.counts();
    $("pw-load-status").textContent = `${counts.basic} basic · ${counts.advanced} advanced words · works offline`;
    $("pw-start").disabled = false;
  }).catch(() => {
    $("pw-load-status").textContent = "Could not load the word bank. Reconnect and reload to try again.";
    $("pw-load-status").classList.add("error");
  });

  function disarmQuit() {
    clearTimeout(quitTimer);
    quitArmed = false;
    $("pw-quit").textContent = "Quit match";
  }

  function showSetup() {
    hideSecret();
    match = null;
    clearTimeout(armTimer);
    disarmQuit();
    releaseWakeLock();
    $("pw-match").hidden = true;
    $("pw-setup").hidden = false;
    window.scrollTo(0, 0);
  }

  $("pw-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("pw-start").disabled) return;
    const first = $("pw-first").value;
    match = PasswordGame.create({
      names: [0, 1].map((i) => $("pw-team-" + i).value.trim() || `Team ${i + 1}`),
      deck: $("pw-deck").value,
      firstTeam: first === "random" ? Math.floor(Math.random() * 2) : Number(first),
      drawWord: GameData.drawSecret
    });
    $("pw-setup").hidden = true;
    $("pw-match").hidden = false;
    render();
    guardTaps();
    acquireWakeLock();
    window.scrollTo(0, 0);
  });

  function render() {
    hideSecret();
    disarmQuit();
    const s = match.getState();
    for (const i of [0, 1]) {
      $("pw-name-" + i).textContent = s.names[i];
      $("pw-score-" + i).textContent = s.scores[i];
      $("pw-card-" + i).classList.toggle("active", s.phase === "playing" && s.team === i);
      $("pw-card-" + i).classList.toggle("winner", s.winner === i);
    }
    const playing = s.phase === "playing";
    $("pw-word-number").textContent = `Word ${s.wordNumber} · ${s.deck} deck · untimed`;
    $("pw-playing").hidden = !playing;
    $("pw-result").hidden = playing;
    $("pw-answer").textContent = playing ? "" : s.word;
    $("pw-next").hidden = s.phase !== "result";
    $("pw-again").hidden = s.phase !== "won";
    $("pw-swap").hidden = s.phase === "won";
    $("pw-undo").disabled = !match.canUndo();
    $("pw-turn").textContent = s.phase === "won" ? `${s.names[s.winner]} wins!` : playing ? `${s.names[s.team]}'s turn` : "Word complete";
    $("pw-value").textContent = playing ? `${s.value} ${s.value === 1 ? "point" : "points"} at stake` : s.phase === "won" ? "First to 15 — match complete" : "";
    let message = "Give one word as a clue. Your teammate gets one guess.";
    if (s.result) {
      const r = s.result;
      if (r.kind === "wrong") message = "Wrong guess. Play passes to the other team for one fewer point.";
      if (r.kind === "illegal") message = "Illegal clue. Turn forfeited; play passes for one fewer point.";
      if (r.kind === "correct") message = `${s.names[r.team]} earns ${r.points} ${r.points === 1 ? "point" : "points"}.`;
      if (r.kind === "said") message = `Password said aloud. ${s.names[r.team]} earns 2 points.`;
      if (r.kind === "exhausted") message = "Six turns used. No points awarded for this word.";
    }
    $("pw-message").textContent = message;
    if (s.phase === "won") releaseWakeLock();
    else acquireWakeLock();
  }

  // A rapid second tap must never record a result for the next team or word.
  function guardTaps() {
    busyUntil = Date.now() + 650;
    actionButtons.forEach((id) => { $(id).disabled = true; });
    clearTimeout(armTimer);
    armTimer = setTimeout(() => {
      if (!match) return;
      actionButtons.forEach((id) => { $(id).disabled = id === "pw-undo" && !match.canUndo(); });
    }, 660);
  }

  function act(fn) {
    if (!match || Date.now() < busyUntil) return;
    hideSecret();
    if (!fn()) return;
    render();
    guardTaps();
  }
  for (const action of ["correct", "wrong", "illegal", "said"]) {
    $("pw-" + action).addEventListener("click", () => act(() => match.record(action)));
  }
  $("pw-next").addEventListener("click", () => act(() => match.nextWord()));
  $("pw-undo").addEventListener("click", () => act(() => match.undo()));
  $("pw-again").addEventListener("click", () => {
    if (Date.now() >= busyUntil) showSetup();
  });
  $("pw-quit").addEventListener("click", () => {
    if (quitArmed) { showSetup(); return; }
    quitArmed = true;
    $("pw-quit").textContent = "Quit — sure?";
    quitTimer = setTimeout(disarmQuit, 3000);
  });

  function hideSecret() {
    clearTimeout(revealTimer);
    $("pw-reveal").hidden = true;
    $("pw-secret").textContent = "";
  }
  function showSecret(event) {
    if (!match || match.getState().phase !== "playing") return;
    if (event.type === "pointerdown" && event.button !== 0) return;
    event.preventDefault();
    hideSecret();
    $("pw-secret").textContent = match.getState().word;
    $("pw-reveal").hidden = false;
    revealTimer = setTimeout(hideSecret, 7000);
  }
  const peek = $("pw-peek");
  peek.addEventListener("pointerdown", (event) => {
    // Keep receiving the release even when the privacy overlay covers the button.
    if (event.button !== 0) return;
    peek.setPointerCapture(event.pointerId);
    showSecret(event);
  });
  peek.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) showSecret(event);
  });
  peek.addEventListener("keyup", hideSecret);
  peek.addEventListener("contextmenu", (event) => event.preventDefault());
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    window.addEventListener(type, hideSecret, true);
  }
  window.addEventListener("blur", hideSecret);
  window.addEventListener("pagehide", () => { hideSecret(); releaseWakeLock(); });

  async function acquireWakeLock() {
    if (!match || match.getState().phase === "won" || document.hidden || wakeLock || wakePending || !("wakeLock" in navigator)) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (!match || match.getState().phase === "won" || document.hidden) { await lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener("release", () => { if (wakeLock === lock) wakeLock = null; });
    } catch (_) { /* Play continues when wake lock is unavailable. */ }
    finally { wakePending = false; }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener("visibilitychange", () => {
    hideSecret();
    if (document.hidden) releaseWakeLock();
    else acquireWakeLock();
  });
})();
