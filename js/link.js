// Peer-to-peer link between the Toastmaster phone ("host") and a second
// "mirror" screen. A WebRTC data channel carries the game state; the
// offer/answer handshake is exchanged as animated QR codes, so no server
// is ever involved. Works only when both phones can reach each other
// directly — same Wi-Fi, or one phone's hotspot (see CLAUDE.md).
const GameLink = (() => {
  let pc = null;
  let ch = null;
  let role = null; // "host" | "mirror"

  const listeners = { message: [], state: [] };
  function on(ev, fn) { if (listeners[ev]) listeners[ev].push(fn); }
  function emit(ev, ...args) { (listeners[ev] || []).forEach((fn) => fn(...args)); }

  // LAN only. No STUN/TURN — we never want an outbound call, and a direct
  // path is the only configuration this feature supports.
  const RTC_CONFIG = { iceServers: [] };

  /* ---------- payload <-> QR frames ---------- */

  const CHUNK = 180; // keeps each QR around version 10 — easy to scan

  async function deflate(str) {
    const bytes = new TextEncoder().encode(str);
    if (typeof CompressionStream === "undefined") return { flag: "u", bytes };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const buf = await new Response(stream).arrayBuffer();
      return { flag: "c", bytes: new Uint8Array(buf) };
    } catch (e) {
      return { flag: "u", bytes };
    }
  }

  async function inflate(flag, bytes) {
    if (flag !== "c" || typeof DecompressionStream === "undefined") {
      return new TextDecoder().decode(bytes);
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buf = await new Response(stream).arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  const b36 = (n) => n.toString(36).toUpperCase();

  function b64uEncode(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64uDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // kind: "O" (offer) | "A" (answer)
  async function toFrames(kind, sdp) {
    const { flag, bytes } = await deflate(sdp);
    const body = flag + b64uEncode(bytes);
    const n = Math.ceil(body.length / CHUNK);
    const frames = [];
    for (let i = 0; i < n; i++) {
      frames.push("FT" + kind + b36(i) + b36(n) + ":" + body.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    return frames;
  }

  // Collects scanned frames until a full set arrives.
  const scan = (() => {
    let kind = null;
    let total = 0;
    let parts = {};
    function reset() { kind = null; total = 0; parts = {}; }
    async function feed(text) {
      const m = /^FT([OA])([0-9A-Z])([0-9A-Z]):([\s\S]*)$/.exec(text || "");
      if (!m) return null;
      const k = m[1];
      const idx = parseInt(m[2], 36);
      const cnt = parseInt(m[3], 36);
      if (k !== kind) { kind = k; total = cnt; parts = {}; }
      parts[idx] = m[4];
      const have = Object.keys(parts).length;
      if (have < total) return { progress: [have, total] };
      let body = "";
      for (let j = 0; j < total; j++) body += parts[j];
      const sdp = await inflate(body[0], b64uDecode(body.slice(1)));
      const result = { kind, sdp };
      reset();
      return result;
    }
    return { feed, reset };
  })();

  /* ---------- WebRTC ---------- */

  function iceComplete(timeoutMs) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const finish = () => { pc.removeEventListener("icegatheringstatechange", check); clearTimeout(timer); resolve(); };
      const check = () => { if (pc.iceGatheringState === "complete") finish(); };
      pc.addEventListener("icegatheringstatechange", check);
      const timer = setTimeout(finish, timeoutMs);
    });
  }

  function wireChannel() {
    ch.onopen = () => emit("state", "connected");
    ch.onclose = () => emit("state", "disconnected");
    ch.onmessage = (e) => { try { emit("message", JSON.parse(e.data)); } catch (_) {} };
  }

  function wirePc() {
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed") emit("state", "disconnected");
      if (s === "connected") emit("state", "connected");
    };
  }

  async function createOffer() {
    close();
    role = "host";
    pc = new RTCPeerConnection(RTC_CONFIG);
    ch = pc.createDataChannel("ft", { ordered: true });
    wireChannel();
    wirePc();
    await pc.setLocalDescription(await pc.createOffer());
    await iceComplete(2500);
    return toFrames("O", pc.localDescription.sdp);
  }

  async function acceptOffer(sdp) {
    close();
    role = "mirror";
    pc = new RTCPeerConnection(RTC_CONFIG);
    pc.ondatachannel = (e) => { ch = e.channel; wireChannel(); };
    wirePc();
    await pc.setRemoteDescription({ type: "offer", sdp: sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await iceComplete(2500);
    return toFrames("A", pc.localDescription.sdp);
  }

  async function acceptAnswer(sdp) {
    await pc.setRemoteDescription({ type: "answer", sdp: sdp });
  }

  function send(obj) {
    if (ch && ch.readyState === "open") {
      try { ch.send(JSON.stringify(obj)); } catch (_) {}
    }
  }

  function isOpen() { return !!ch && ch.readyState === "open"; }
  function getRole() { return role; }

  function close() {
    try { if (ch) ch.close(); } catch (_) {}
    try { if (pc) pc.close(); } catch (_) {}
    ch = null;
    pc = null;
    role = null;
    scan.reset();
  }

  return {
    on, createOffer, acceptOffer, acceptAnswer,
    feedScan: scan.feed, resetScan: scan.reset,
    send, isOpen, getRole, close
  };
})();
