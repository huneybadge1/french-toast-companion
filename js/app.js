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
    btnDealCancel: $("btn-deal-cancel"),
    // multi-screen
    screenMirror: $("screen-mirror"),
    screen2Strip: $("screen2-strip"),
    scaleStrip: $("scale-strip"),
    linkPill: $("link-pill"),
    linkPillText: $("link-pill-text"),
    btnMultiscreen: $("btn-multiscreen"),
    mirrorWait: $("mirror-wait"),
    mirrorWaitText: $("mirror-wait-text"),
    mirrorGame: $("mirror-game"),
    mirrorRound: $("mirror-round"),
    mirrorTimer: $("mirror-timer"),
    mirrorTrack: $("mirror-track"),
    mirrorEnd: $("mirror-end"),
    mirrorEndEmoji: $("mirror-end-emoji"),
    mirrorEndTitle: $("mirror-end-title"),
    pairOverlay: $("pair-overlay"),
    pairRole: $("pair-role"),
    pairBeHost: $("pair-be-host"),
    pairBeMirror: $("pair-be-mirror"),
    pairCancel: $("pair-cancel"),
    pairShow: $("pair-show"),
    pairShowTitle: $("pair-show-title"),
    pairShowText: $("pair-show-text"),
    pairQr: $("pair-qr"),
    pairShowNext: $("pair-show-next"),
    pairAbort: $("pair-abort"),
    pairScan: $("pair-scan"),
    pairScanTitle: $("pair-scan-title"),
    pairScanText: $("pair-scan-text"),
    pairCam: $("pair-cam"),
    pairScanStatus: $("pair-scan-status"),
    pairScanAbort: $("pair-scan-abort"),
    pairLinking: $("pair-linking")
  };

  // pending: the hint currently "in hand" — { text, fresh }. fresh:true is
  // this round's freshly-dealt hint (must be placed to arm Start); fresh:false
  // is a placed hint lifted to be moved.
  let pending = null;
  let dealtPair = null;
  let reminderShown = false;
  let quitArmed = false;
  let quitTimer = null;

  // "solo" (default, one device) | "host" (drives a mirror) | "mirror" (display)
  let mode = "solo";
  let timerSec = null; // last countdown value shown, for syncing to the mirror
  let gameActive = false; // a game is in progress (vs. sitting on setup)

  // Positions 0-2 live on the host's main scale; 3-5 on the mirror. In solo
  // mode all 6 are on the one screen.
  const HOST_SPLIT = 3;

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
    [els.screenSetup, els.screenGame, els.screenWin, els.screenLoss, els.screenMirror].forEach((s) => (s.hidden = true));
    screen.hidden = false;
    els.btnQuit.hidden = !(screen === els.screenGame || screen === els.screenMirror);
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
    gameActive = true;
    els.tmReminder.hidden = true;
    show(els.screenGame);
    renderRound();
  }

  function renderRound() {
    timerSec = null;
    els.roundNum.textContent = Game.getRound();
    els.timer.textContent = Game.ROUND_SECONDS;
    els.timer.classList.remove("low");
    renderScale();
    updateControls();
    syncOut();
  }

  function buildSlots(container, from, to) {
    container.innerHTML = "";
    for (let i = from; i < to; i++) {
      const items = HintScale.bySlot(i);
      const slot = document.createElement("div");
      slot.className = "slot" + (items.length ? " filled" : "");
      slot.dataset.slot = String(i);
      if (items.length > 1) slot.classList.add("stacked");
      items.forEach((item) => {
        const chip = document.createElement("span");
        chip.className = "slot-chip";
        chip.dataset.id = String(item.id);
        chip.textContent = item.text;
        slot.appendChild(chip);
      });
      container.appendChild(slot);
    }
    container.querySelectorAll(".slot").forEach(fitSlotChips);
  }

  function renderScale() {
    const placing = !!pending;
    els.scaleTrack.classList.toggle("placing", placing);
    els.scaleStrip.classList.toggle("placing", placing);
    if (mode === "host") {
      buildSlots(els.scaleTrack, 0, HOST_SPLIT);
      buildSlots(els.scaleStrip, HOST_SPLIT, HintScale.SLOTS);
      els.screen2Strip.hidden = false;
    } else {
      buildSlots(els.scaleTrack, 0, HintScale.SLOTS);
      els.screen2Strip.hidden = true;
    }
  }

  // Size every chip in a slot so the (possibly stacked) column fits. Long
  // adjectives wrap rather than break mid-word (CSS); this shrinks further
  // only if the column is still taller than the slot.
  function fitSlotChips(slot) {
    const chips = slot.querySelectorAll(".slot-chip");
    if (!chips.length) return;
    const mini = !!slot.closest(".scale-track--mini");
    const n = chips.length;
    let size = mini ? (n === 1 ? 12 : 10) : (n === 1 ? 21 : n === 2 ? 16 : 13);
    const apply = () => chips.forEach((c) => (c.style.fontSize = size + "px"));
    apply();
    let guard = 0;
    while (size > 9 && slot.scrollHeight > slot.clientHeight && guard++ < 24) {
      size -= 1;
      apply();
    }
  }

  // One handler covers the main scale and (in host mode) the Screen-2 strip.
  els.screenGame.addEventListener("click", (e) => {
    if (Game.getPhase() === "running") return; // hints locked during countdown
    const slotEl = e.target.closest(".slot");
    if (!slotEl || !els.screenGame.contains(slotEl)) return;
    const idx = Number(slotEl.dataset.slot);

    if (pending) {
      // Drop into this position — any position accepts any number of hints.
      HintScale.add(idx, pending.text);
      const wasFresh = pending.fresh;
      pending = null;
      if (wasFresh) {
        Game.setPhase("ready");
        maybeShowReminder();
      }
    } else {
      // Lift the specific hint that was tapped, to move it.
      const chipEl = e.target.closest(".slot-chip");
      if (!chipEl) return;
      const item = HintScale.take(Number(chipEl.dataset.id));
      if (!item) return;
      pending = { text: item.text, fresh: false };
    }
    renderScale();
    updateControls();
    syncOut();
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
    pending = { text: chosen, fresh: true };
    Game.setPhase("place");
    renderScale();
    updateControls();
    syncOut();
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
    acquireWakeLock(); // keep the screen on while the phone sits on the table
    Game.startTimer(onTick, onRoundEnd);
    updateControls();
    syncOut();
  });

  els.btnGotit.addEventListener("click", () => {
    if (Game.getPhase() !== "running") return;
    Game.win();
    releaseWakeLock();
    GameAudio.win();
    if (navigator.vibrate) navigator.vibrate(120);
    showWin();
  });

  /* ---------- screen wake lock (running rounds only) ---------- */

  let wakeLock = null;
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch (e) {
      wakeLock = null; // denied / unsupported / not visible — the round just runs without it
    }
  }
  function releaseWakeLock() {
    if (!wakeLock) return;
    try { wakeLock.release(); } catch (e) { /* no-op */ }
    wakeLock = null;
  }

  function onTick(sec) {
    timerSec = sec;
    els.timer.textContent = sec;
    els.timer.classList.toggle("low", sec <= 10);
    // No sound during a round — the countdown is visual only.
    syncOut();
  }

  function onRoundEnd() {
    releaseWakeLock();
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
    const n = HintScale.count();
    els.winDetail.textContent =
      `Guessed on round ${Game.getRound()} of ${Game.ROUNDS} · ${n} hint${n === 1 ? "" : "s"} on the scale.`;
    show(els.screenWin);
    syncOut();
  }

  function showLoss() {
    show(els.screenLoss);
    syncOut();
  }

  els.btnWinAgain.addEventListener("click", backToSetup);
  els.btnLossAgain.addEventListener("click", backToSetup);

  function backToSetup() {
    Game.stopTimer();
    releaseWakeLock();
    HintScale.reset();
    pending = null;
    dealtPair = null;
    timerSec = null;
    gameActive = false;
    els.peekOverlay.hidden = true;
    if (mode === "host") {
      // Keep the phones linked; just send the mirror back to its waiting state.
      GameLink.send({ t: "bye" });
    } else if (mode === "mirror") {
      teardownLink();
    }
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

  /* ==================================================================
     Multi-screen: pair a second phone so the scale spans both screens.
     Purely additive — solo play never touches any of this.
     ================================================================== */

  let linkFramesStop = null; // stops the animated QR
  let linkScanStop = null;   // stops the camera
  let linkConnected = false;

  /* ---- host -> mirror: broadcast the whole state on every change ---- */

  function syncOut() {
    if (mode !== "host" || !GameLink.isOpen()) return;
    if (!gameActive) { GameLink.send({ t: "bye" }); return; }
    const phase = Game.getPhase();
    GameLink.send({
      t: "s",
      rd: Game.getRound(),
      ph: phase,
      it: HintScale.all().map((x) => [x.id, x.text, x.slot]),
      tm: phase === "running" ? timerSec : null,
      res: phase === "won" ? "won" : phase === "lost" ? "lost" : null
    });
  }

  /* ---- mirror: apply state from the host ---- */

  function applyMirrorState(s) {
    if (s.t === "bye") {
      releaseWakeLock();
      els.mirrorGame.hidden = true;
      els.mirrorEnd.hidden = true;
      els.mirrorWait.hidden = false;
      els.mirrorWaitText.textContent = "Linked. Waiting for Screen 1 to start…";
      return;
    }
    if (s.t !== "s") return;

    if (s.res === "won" || s.res === "lost") {
      releaseWakeLock();
      els.mirrorWait.hidden = true;
      els.mirrorGame.hidden = true;
      els.mirrorEnd.hidden = false;
      els.mirrorEndEmoji.textContent = s.res === "won" ? "🍽" : "⏳";
      els.mirrorEndTitle.textContent = s.res === "won" ? "They got it!" : "Out of rounds";
      return;
    }

    els.mirrorWait.hidden = true;
    els.mirrorEnd.hidden = true;
    els.mirrorGame.hidden = false;
    els.mirrorRound.textContent = s.rd;
    els.mirrorTimer.textContent = s.tm == null ? Game.ROUND_SECONDS : s.tm;
    els.mirrorTimer.classList.toggle("low", s.tm != null && s.tm <= 10);
    if (s.tm != null) acquireWakeLock(); else releaseWakeLock();

    els.mirrorTrack.innerHTML = "";
    for (let i = HOST_SPLIT; i < HintScale.SLOTS; i++) {
      const here = (s.it || []).filter((a) => a[2] === i);
      const slot = document.createElement("div");
      slot.className = "slot" + (here.length ? " filled" : "") + (here.length > 1 ? " stacked" : "");
      slot.dataset.slot = String(i);
      here.forEach((a) => {
        const chip = document.createElement("span");
        chip.className = "slot-chip";
        chip.textContent = a[1];
        slot.appendChild(chip);
      });
      els.mirrorTrack.appendChild(slot);
    }
    els.mirrorTrack.querySelectorAll(".slot").forEach(fitSlotChips);
  }

  /* ---- QR encode: draw (animated) frames to a canvas ---- */

  function renderQrFrames(canvas, frames) {
    const ctx = canvas.getContext("2d");
    let fi = 0;
    function draw() {
      const qr = qrcode(0, "L");
      qr.addData(frames[fi]);
      qr.make();
      const n = qr.getModuleCount();
      const cell = Math.floor(canvas.width / (n + 4));
      const pad = Math.floor((canvas.width - cell * n) / 2);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
        }
      }
      fi = (fi + 1) % frames.length;
    }
    draw();
    if (frames.length > 1) {
      const id = setInterval(draw, 550);
      return () => clearInterval(id);
    }
    return () => {};
  }

  /* ---- QR decode: camera scan, collecting multi-frame payloads ---- */

  async function startQrScan(video, statusEl, onResult) {
    let stopped = false;
    let raf = 0;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (err) {
      statusEl.textContent = "Camera unavailable — " + (err.message || err.name);
      return function () {};
    }
    video.srcObject = stream;
    try { await video.play(); } catch (_) {}

    let detector = null;
    if ("BarcodeDetector" in window) {
      try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch (_) {}
    }
    const cv = document.createElement("canvas");
    const cx = cv.getContext("2d", { willReadFrequently: true });
    statusEl.textContent = "Point at the other phone’s code";

    async function tick() {
      if (stopped) return;
      if (video.videoWidth) {
        cv.width = video.videoWidth;
        cv.height = video.videoHeight;
        cx.drawImage(video, 0, 0);
        let text = null;
        if (detector) {
          try {
            const codes = await detector.detect(cv);
            if (codes && codes[0]) text = codes[0].rawValue;
          } catch (_) {}
        }
        if (!text && typeof jsQR === "function") {
          const img = cx.getImageData(0, 0, cv.width, cv.height);
          const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (found) text = found.data;
        }
        if (text) {
          try {
            const res = await GameLink.feedScan(text);
            if (res && res.sdp) { stop(); onResult(res); return; }
            if (res && res.progress) {
              statusEl.textContent = "Captured " + res.progress[0] + " / " + res.progress[1] + " — hold steady";
            }
          } catch (_) {}
        }
      }
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    tick();
    return stop;
  }

  /* ---- pairing flow ---- */

  function pairStep(el) {
    [els.pairRole, els.pairShow, els.pairScan, els.pairLinking].forEach((s) => (s.hidden = true));
    el.hidden = false;
  }

  function stopPairMedia() {
    if (linkFramesStop) { linkFramesStop(); linkFramesStop = null; }
    if (linkScanStop) { linkScanStop(); linkScanStop = null; }
  }

  function closePairing() {
    stopPairMedia();
    els.pairOverlay.hidden = true;
  }

  function refreshMultiscreenBtn() {
    els.btnMultiscreen.innerHTML = mode === "solo"
      ? "◫ Two screens <span class=\"beta\">beta</span>"
      : "◫ Unlink second screen";
  }

  els.btnMultiscreen.addEventListener("click", () => {
    if (mode !== "solo") {
      teardownLink();
      refreshMultiscreenBtn();
      return;
    }
    GameLink.resetScan();
    pairStep(els.pairRole);
    els.pairOverlay.hidden = false;
  });

  els.pairCancel.addEventListener("click", closePairing);
  els.pairAbort.addEventListener("click", () => { GameLink.close(); closePairing(); });
  els.pairScanAbort.addEventListener("click", () => { GameLink.close(); closePairing(); });

  // Host: create an offer, show it, then scan the mirror's answer.
  els.pairBeHost.addEventListener("click", async () => {
    pairStep(els.pairShow);
    els.pairShowTitle.textContent = "Show this to the right screen";
    els.pairShowText.textContent = "Hold it up to the other phone’s camera.";
    els.pairShowNext.hidden = false;
    stopPairMedia();
    try {
      const frames = await GameLink.createOffer();
      linkFramesStop = renderQrFrames(els.pairQr, frames);
    } catch (err) {
      els.pairShowText.textContent = "Could not start — " + (err.message || err.name);
    }
  });

  els.pairShowNext.addEventListener("click", async () => {
    stopPairMedia();
    pairStep(els.pairScan);
    els.pairScanTitle.textContent = "Now scan the right screen";
    linkScanStop = await startQrScan(els.pairCam, els.pairScanStatus, async (res) => {
      pairStep(els.pairLinking);
      try { await GameLink.acceptAnswer(res.sdp); } catch (_) {}
      // onLinkUp fires when the data channel opens
    });
  });

  // Mirror: scan the host's offer, then show the answer back.
  els.pairBeMirror.addEventListener("click", async () => {
    stopPairMedia();
    pairStep(els.pairScan);
    els.pairScanTitle.textContent = "Scan the left screen";
    linkScanStop = await startQrScan(els.pairCam, els.pairScanStatus, async (res) => {
      pairStep(els.pairLinking);
      let frames;
      try {
        frames = await GameLink.acceptOffer(res.sdp);
      } catch (err) {
        pairStep(els.pairScan);
        els.pairScanStatus.textContent = "Handshake failed — try again";
        return;
      }
      pairStep(els.pairShow);
      els.pairShowTitle.textContent = "Show this back to the left screen";
      els.pairShowText.textContent = "Then wait — it links on its own.";
      els.pairShowNext.hidden = true;
      stopPairMedia();
      linkFramesStop = renderQrFrames(els.pairQr, frames);
    });
  });

  /* ---- GameLink events ---- */

  GameLink.on("state", (st) => {
    if (st === "connected" && !linkConnected) {
      linkConnected = true;
      onLinkUp();
    } else if (st === "disconnected" && linkConnected) {
      linkConnected = false;
      onLinkDown();
    }
  });

  GameLink.on("message", (msg) => {
    if (mode === "mirror") applyMirrorState(msg);
  });

  function onLinkUp() {
    stopPairMedia();
    els.pairOverlay.hidden = true;
    mode = GameLink.getRole() === "host" ? "host" : "mirror";
    document.body.classList.toggle("ms-host", mode === "host");
    document.body.classList.toggle("ms-mirror", mode === "mirror");
    refreshMultiscreenBtn();
    updateLinkPill(true);
    if (mode === "mirror") {
      els.mirrorWait.hidden = false;
      els.mirrorGame.hidden = true;
      els.mirrorEnd.hidden = true;
      show(els.screenMirror);
    } else {
      renderScale();
      syncOut();
    }
  }

  function onLinkDown() {
    updateLinkPill(false);
    if (mode === "mirror") {
      els.mirrorWaitText.textContent = "Lost the link — re-pair from Screen 1.";
      els.mirrorGame.hidden = true;
      els.mirrorEnd.hidden = true;
      els.mirrorWait.hidden = false;
      releaseWakeLock();
    }
  }

  function updateLinkPill(up) {
    if (mode === "solo") { els.linkPill.hidden = true; return; }
    els.linkPill.hidden = false;
    els.linkPill.classList.toggle("down", !up);
    els.linkPillText.textContent = up
      ? (mode === "host" ? "Screen 2 linked" : "linked")
      : "reconnect…";
  }

  function teardownLink() {
    GameLink.close();
    linkConnected = false;
    mode = "solo";
    document.body.classList.remove("ms-host", "ms-mirror");
    els.linkPill.hidden = true;
    els.screen2Strip.hidden = true;
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
    if (document.hidden) {
      Game.pause();
    } else {
      Game.resume();
      // Wake locks drop when the page is hidden — take it again if a round
      // is still running.
      if (Game.getPhase() === "running") acquireWakeLock();
    }
  });
})();
