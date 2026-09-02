// The Hint Scale: 6 fixed slots from "IS" (0) to "IS NOT" (5). At most
// one hint per slot. Hints can be moved between slots but never removed
// once placed. The game only ever fills 5 of the 6 slots (5 rounds).
const HintScale = (() => {
  const SLOTS = 6;
  let slots = new Array(SLOTS).fill(null);

  function reset() { slots = new Array(SLOTS).fill(null); }

  function place(index, text) {
    if (index < 0 || index >= SLOTS) return false;
    if (slots[index]) return false;      // never overwrite an occupied slot
    slots[index] = text;
    return true;
  }

  function lift(index) {
    const text = slots[index] || null;
    slots[index] = null;
    return text;
  }

  function get(index) { return slots[index] || null; }
  function all() { return slots.slice(); }
  function placedCount() { return slots.filter(Boolean).length; }
  function isEmpty(index) { return !slots[index]; }
  function firstOpen() { return slots.findIndex((s) => !s); }

  return { SLOTS, reset, place, lift, get, all, placedCount, isEmpty, firstOpen };
})();
