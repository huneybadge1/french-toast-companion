// The Hint Scale: 6 fixed positions from "IS" (0) to "IS NOT" (5).
// Multiple hints may share a position. Hints can be moved between positions
// but are never removed once placed (a "move" is a lift + drop).
const HintScale = (() => {
  const SLOTS = 6;
  let items = [];       // [{ id, text, slot }]
  let nextId = 1;

  function reset() { items = []; nextId = 1; }

  function add(slot, text) {
    const item = { id: nextId++, text: text, slot: slot };
    items.push(item);
    return item.id;
  }

  // Pull an item out (used when lifting a placed hint to move it).
  function take(id) {
    const i = items.findIndex((x) => x.id === id);
    return i >= 0 ? items.splice(i, 1)[0] : null;
  }

  function bySlot(slot) { return items.filter((x) => x.slot === slot); }
  function all() { return items.slice(); }
  function count() { return items.length; }

  return { SLOTS, reset, add, take, bySlot, all, count };
})();
