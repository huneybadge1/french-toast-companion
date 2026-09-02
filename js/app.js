// DOM wiring for the French Toast Toastmaster companion. IIFE; `els`
// caches every DOM ref by id. Game/scale/timer state lives in the other
// modules — this file only orchestrates and renders.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    rotate: $("rotate-overlay"),
    screenSetup: $("screen-setup"),
    screenGame: $("screen-game"),
    screenWin: $("screen-win"),
    screenLoss: $("screen-loss"),
    setupStatus: $("setup-status"),
    roundNum: $("round-num"),
    timer: $("timer"),
    scaleTrack: $("scale-track"),
    tmReminder: $("tm-reminder"),
    tmReminderDismiss: $("tm-reminder-dismiss"),
    tmStatus: $("tm-status"),
    btnPeek: $("btn-peek"),
    btnDeal: $("btn-deal"),
    btnStart: $("btn-start"),
    btnGotit: $("btn-gotit"),
    winDetail: $("win-detail"),
    btnWinAgain: $("btn-win-again"),
    btnLossAgain: $("btn-loss-again"),
    versionBadge: $("version-badge"),
    btnQuit: $("btn-quit"),
    peekOverlay: $("peek-overlay"),
    peekWord: $("peek-word"),
    customOverlay: $("custom-overlay"),
    customInput: $("custom-input"),
    btnCustomOk: $("btn-custom-ok"),
    btnCustomCancel: $("btn-custom-cancel"),
    dealOverlay: $("deal-overlay"),
    dealA: $("deal-a"),
    dealB: $("deal-b"),
    btnDealCancel: $("btn-deal-cancel")
  };

  // pending: the hint currently "in hand". fromSlot null = freshly dealt
  // (must be placed to arm Start); a number = lifted from that slot.
  let pending = null;
  let dealtPair = null;
  let reminderShown = false;
  let quitArmed = false;
  let quitTimer = null;

  /* ---------- boot ---------- */

  els.versionBadge.textContent = APP_VERSION;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((reg) => reg.update()).catch(() => {});
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  window.addEventListener("pointerdown", () => GameAudio.unlock(), { once: true });

  GameData.load()
    .then(() => {
      GameData.resetForGame();
      const c = GameData.counts();
      els.setupStatus.textContent = c
        ? `${c.basic} basic · ${c.advanced} advanced words · ${c.hints} hints — works offline`
        : "";
      els.setupStatus.classList.remove("error");
      document.querySelectorAll(".deck-btn").forEach((b) => (b.disabled = false));
    })
    .catch((err) => {
      els.setupStatus.textContent = "Could not load the word bank. " + err.message;
      els.setupStatus.classList.add("error");
    });

  /* ---------- screen switching ---------- */

  function show(screen) {
    [els.screenSetup, els.screenGame, els.screenWin, els.screenLoss].forEach((s) => (s.hidden = true));
    screen.hidden = false;
    els.btnQuit.hidden = screen !== els.screenGame;
    disarmQuit();
  }

  /* ---------- setup ---------- */

  document.querySelectorAll(".deck-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deck = btn.dataset.deck;
      if (deck === "custom") {
        els.customInput.value = "";
        els.customOverlay.hidden = false;
        setTimeout(() => els.customInput.focus(), 50);
        return;
      }
      const word = GameData.drawSecret(deck);
      if (!word) return;
      startGame(deck, word);
    });
  });

  els.btnCustomOk.addEventListener("click", () => {
    const word = els.customInput.value.trim().replace(/\s+/g, " ");
    if (!word) {
      els.customInput.focus();
      return;
    }
    els.customOverlay.hidden = true;
    startGame("custom", word);
  });

  els.btnCustomCancel.addEventListener("click", () => {
    els.customOverlay.hidden = true;
  });

  /* ---------- game lifecycle ---------- */

  function startGame(deck, word) {
    GameData.resetForGame();
    HintScale.reset();
    Game.newGame(deck, word);
    pending = null;
    dealtPair = null;
    reminderShown = false;
    els.tmReminder.hidden = true;
    show(els.screenGame);
    renderRound();
  }

  function renderRound() {
    els.roundNum.textContent = Game.getRound();
    els.timer.textContent = Game.ROUND_SECONDS;
    els.timer.classList.remove("low");
    renderScale();
    updateControls();
  }

  function renderScale() {
    const slots = HintScale.all();
    els.scaleTrack.classList.toggle("placing", !!pending);
    els.scaleTrack.innerHTML = "";
    slots.forEach((text, i) => {
      const slot = document.createElement("div");
      slot.className = "slot" + (text ? " filled" : "");
      slot.dataset.slot = String(i);
      if (text) {
        const chip = document.createElement("span");
        chip.className = "slot-chip";
        chip.textContent = text;
        slot.appendChild(chip);
      }
      els.scaleTrack.appendChild(slot);
    });
    // Shrink each hint until it fits its slot on one or two lines — long
    // adjectives ("transparent", "complicated") must never break mid-word.
    els.scaleTrack.querySelectorAll(".slot-chip").forEach(fitChip);
  }

  // Long adjectives wrap to 2-3 lines (word-break in CSS); this only pulls
  // the size down further if the wrapped text is still taller than the slot.
  function fitChip(chip) {
    const maxH = chip.parentElement.clientHeight - 16;
    let size = 21;
    chip.style.fontSize = size + "px";
    while (size > 11 && chip.scrollHeight > maxH) {
      size -= 1;
      chip.style.fontSize = size + "px";
    }
  }

  els.scaleTrack.addEventListener("click", (e) => {
    const slotEl = e.target.closest(".slot");
    if (!slotEl) return;
    if (Game.getPhase() === "running") return; // hints locked during countdown
    const idx = Number(slotEl.dataset.slot);
    const occupied = !HintScale.isEmpty(idx);

    if (pending) {
      if (occupied) return; // can only drop on an open slot
      HintScale.place(idx, pending.text);
      const wasFresh = pending.fromSlot === null;
      pending = null;
      if (wasFresh) {
        Game.setPhase("ready");
        maybeShowReminder();
      }
    } else {
      if (!occupied) return; // nothing to pick up
      pending = { text: HintScale.get(idx), fromSlot: idx };
      HintScale.lift(idx);
    }
    renderScale();
    updateControls();
  });

  /* ---------- Toastmaster controls ---------- */

  els.btnDeal.addEventListener("click", () => {
    if (Game.getPhase() !== "deal") return;
    dealtPair = GameData.dealHints();
    els.dealA.textContent = dealtPair[0];
    els.dealB.textContent = dealtPair[1];
    els.dealOverlay.hidden = false;
  });

  function chooseHint(which) {
    if (!dealtPair) return;
    const chosen = which === "a" ? dealtPair[0] : dealtPair[1];
    dealtPair = null;
    els.dealOverlay.hidden = true;
    pending = { text: chosen, fromSlot: null };
    Game.setPhase("place");
    renderScale();
    updateControls();
  }

  els.dealA.addEventListener("click", () => chooseHint("a"));
  els.dealB.addEventListener("click", () => chooseHint("b"));

  els.btnDealCancel.addEventListener("click", () => {
    if (dealtPair) GameData.returnHints(dealtPair);
    dealtPair = null;
    els.dealOverlay.hidden = true;
  });

  els.btnStart.addEventListener("click", () => {
    if (Game.getPhase() !== "ready") return;
    GameAudio.unlock();
    els.tmReminder.hidden = true;
    Game.startTimer(onTick, onRoundEnd);
    updateControls();
  });

  els.btnGotit.addEventListener("click", () => {
    if (Game.getPhase() !== "running") return;
    Game.win();
    GameAudio.win();
    if (navigator.vibrate) navigator.vibrate(120);
    showWin();
  });

  function onTick(sec) {
    els.timer.textContent = sec;
    els.timer.classList.toggle("low", sec <= 10);
    // No sound during a round — the countdown is visual only.
  }

  function onRoundEnd() {
    GameAudio.buzzer();
    if (navigator.vibrate) navigator.vibrate([220, 90, 220]);
    els.timer.classList.add("low");
    const more = Game.nextRound();
    if (more) {
      pending = null;
      renderRound();
    } else {
      showLoss();
    }
  }

  function showWin() {
    const n = HintScale.placedCount();
    els.winDetail.textContent =
      `Guessed on round ${Game.getRound()} of ${Game.ROUNDS} · ${n} hint${n === 1 ? "" : "s"} on the scale.`;
    show(els.screenWin);
  }

  function showLoss() {
    show(els.screenLoss);
  }

  els.btnWinAgain.addEventListener("click", backToSetup);
  els.btnLossAgain.addEventListener("click", backToSetup);

  function backToSetup() {
    Game.stopTimer();
    HintScale.reset();
    pending = null;
    dealtPair = null;
    els.peekOverlay.hidden = true;
    show(els.screenSetup);
  }

  /* ---------- quit (two-tap) ---------- */

  els.btnQuit.addEventListener("click", () => {
    if (quitArmed) {
      disarmQuit();
      backToSetup();
      return;
    }
    quitArmed = true;
    els.btnQuit.classList.add("armed");
    els.btnQuit.textContent = "Quit — sure?";
    quitTimer = setTimeout(disarmQuit, 3000);
  });

  function disarmQuit() {
    quitArmed = false;
    if (quitTimer) clearTimeout(quitTimer);
    quitTimer = null;
    els.btnQuit.classList.remove("armed");
    els.btnQuit.textContent = "Quit";
  }

  /* ---------- controls / status render ---------- */

  function updateControls() {
    const phase = Game.getPhase();
    const running = phase === "running";
    els.btnPeek.disabled = false;
    els.btnDeal.disabled = phase !== "deal";
    els.btnStart.hidden = running;
    // Not while a hint is still "in hand" mid-rearrange.
    els.btnStart.disabled = phase !== "ready" || !!pending;
    els.btnGotit.hidden = !running;

    let msg = "";
    if (phase === "deal") msg = `Round ${Game.getRound()} — deal two hints.`;
    else if (phase === "place" && pending) msg = `Placing <strong>${esc(pending.text)}</strong> — tap a slot on the scale.`;
    else if (pending) msg = `Moving <strong>${esc(pending.text)}</strong> — tap an open slot.`;
    else if (phase === "ready") msg = "Hint placed. Rearrange any hint, then Start.";
    else if (running) msg = "";
    els.tmStatus.innerHTML = msg;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function maybeShowReminder() {
    if (reminderShown || Game.getRound() !== 1) return;
    reminderShown = true;
    els.tmReminder.hidden = false;
  }

  els.tmReminderDismiss.addEventListener("click", () => (els.tmReminder.hidden = true));

  /* ---------- shielded peek (press and hold) ---------- */

  let peekFailsafe = null;
  function peekShow(e) {
    if (e) e.preventDefault();
    els.peekWord.textContent = Game.getSecretWord() || "—";
    els.peekOverlay.hidden = false;
    clearTimeout(peekFailsafe);
    peekFailsafe = setTimeout(peekHide, 7000);
  }
  function peekHide() {
    els.peekOverlay.hidden = true;
    clearTimeout(peekFailsafe);
  }
  function bindHoldReveal(btn) {
    btn.addEventListener("pointerdown", peekShow);
    btn.addEventListener("pointerup", peekHide);
    btn.addEventListener("pointerleave", peekHide);
    btn.addEventListener("pointercancel", peekHide);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  bindHoldReveal(els.btnPeek);
  document.querySelectorAll("[data-hold-reveal]").forEach(bindHoldReveal);

  /* ---------- orientation + backgrounding (pause the timer) ---------- */

  const portraitMq = window.matchMedia("(orientation: portrait)");
  function checkOrientation() {
    const portrait = portraitMq.matches;
    els.rotate.hidden = !portrait;
    if (portrait) Game.pause();
    else Game.resume();
  }
  if (portraitMq.addEventListener) portraitMq.addEventListener("change", checkOrientation);
  else portraitMq.addListener(checkOrientation);
  window.addEventListener("resize", checkOrientation);
  checkOrientation();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Game.pause();
    else Game.resume();
  });
})();
