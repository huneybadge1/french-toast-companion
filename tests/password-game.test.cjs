const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('js/password-game.js', 'utf8') + '\nthis.PasswordGame = PasswordGame;', context);
const { PasswordGame } = context;
function game(firstTeam = 0) {
  let n = 0;
  return PasswordGame.create({ names: ['Gold', 'Berry'], deck: 'basic', firstTeam, drawWord: () => `word${++n}` });
}
function state(g) { return JSON.parse(JSON.stringify(g.getState())); }

test('each possible correct turn awards its value to the active team', () => {
  for (const starter of [0, 1]) {
    for (let misses = 0; misses < 6; misses++) {
      const g = game(starter);
      for (let i = 0; i < misses; i++) g.record('wrong');
      const active = (starter + misses) % 2;
      assert.equal(state(g).team, active);
      g.record('correct');
      assert.equal(state(g).scores[active], 6 - misses);
      assert.equal(state(g).scores[1 - active], 0);
      assert.equal(state(g).phase, 'result');
      assert.equal(g.record('correct'), false, 'resolved word cannot award points twice');
    }
  }
});

test('illegal clues consume a turn; six misses exhaust the word without points', () => {
  const g = game();
  for (let i = 0; i < 6; i++) g.record(i % 2 ? 'illegal' : 'wrong');
  assert.deepEqual(state(g).scores, [0, 0]);
  assert.equal(state(g).result.kind, 'exhausted');
  assert.equal(state(g).phase, 'result');
  assert.equal(g.nextWord(), true);
  assert.equal(state(g).wordNumber, 2);
  assert.equal(state(g).team, 1);
  assert.equal(state(g).value, 6);
});

test('saying the password awards exactly two to the opponent at every clue value', () => {
  for (const starter of [0, 1]) {
    for (let misses = 0; misses < 6; misses++) {
      const g = game(starter);
      for (let i = 0; i < misses; i++) g.record('wrong');
      const opponent = 1 - state(g).team;
      g.record('said');
      assert.equal(state(g).scores[opponent], 2);
      assert.equal(state(g).scores[1 - opponent], 0);
      assert.equal(state(g).phase, 'result');
    }
  }
});

test('15 exactly and scores above 15 win immediately; no new word after victory', () => {
  for (const exact of [true, false]) {
    const g = game();
    g.record('correct'); // Gold 6
    g.nextWord(); g.record('wrong'); g.record('correct'); // Gold 11
    g.nextWord();
    if (exact) { g.record('wrong'); g.record('wrong'); }
    g.record('correct'); // Gold 15 or 17
    assert.equal(state(g).scores[0], exact ? 15 : 17);
    assert.equal(state(g).winner, 0);
    assert.equal(state(g).phase, 'won');
    assert.equal(g.nextWord(), false);
    assert.equal(g.record('said'), false);
  }
});

test('a password disclosure can award the winning points', () => {
  const g = game();
  g.record('correct'); // Gold 6
  g.nextWord(); g.record('said'); // Gold 8
  g.nextWord(); g.record('wrong'); g.record('wrong'); g.record('correct'); // Gold 12
  g.nextWord(); g.record('wrong'); g.record('wrong'); g.record('wrong'); g.record('wrong'); g.record('wrong'); g.record('correct'); // Gold 13
  g.nextWord(); g.record('wrong'); g.record('said'); // Gold 15
  assert.equal(state(g).winner, 0);
  assert.equal(state(g).scores[0], 15);
});

test('undo restores turns, resolved words, scores, and victory without changing the secret', () => {
  const g = game();
  const initial = state(g);
  g.record('illegal'); g.undo();
  assert.deepEqual(state(g), initial);
  g.record('said');
  const resolved = state(g);
  g.nextWord(); g.undo();
  assert.deepEqual(state(g), resolved);
  g.undo();
  assert.deepEqual(state(g), initial);
  assert.equal(g.canUndo(), false);
  g.record('correct'); g.nextWord(); g.record('wrong'); g.record('correct'); g.nextWord();
  const beforeWin = state(g);
  g.record('correct'); g.undo();
  assert.deepEqual(state(g), beforeWin);
  assert.equal(state(g).phase, 'playing');
});

test('starts alternate by word, independent of who wins the previous word', () => {
  const g = game(1);
  assert.equal(state(g).team, 1);
  g.record('wrong'); g.record('correct'); g.nextWord();
  assert.equal(state(g).team, 0);
  g.record('said'); g.nextWord();
  assert.equal(state(g).team, 1);
  const snapshot = state(g); snapshot.scores[0] = 999;
  assert.notEqual(state(g).scores[0], 999, 'callers cannot mutate game state');
});
