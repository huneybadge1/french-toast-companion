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
function nextWord(g, starter) {
  assert.equal(g.nextWord(), true);
  if (state(g).phase === 'choice') {
    g.chooseStart(starter === undefined || starter === state(g).chooser ? 'play' : 'pass');
  }
  if (starter !== undefined) assert.equal(state(g).team, starter);
}

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
  assert.equal(state(g).team, 0);
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
    nextWord(g, 1); g.record('wrong'); g.record('correct'); // Gold 11
    nextWord(g, 0);
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
  nextWord(g, 1); g.record('said'); // Gold 8
  nextWord(g, 0); g.record('wrong'); g.record('wrong'); g.record('correct'); // Gold 12
  nextWord(g, 1); g.record('wrong'); g.record('wrong'); g.record('wrong'); g.record('wrong'); g.record('wrong'); g.record('correct'); // Gold 13
  nextWord(g, 0); g.record('wrong'); g.record('said'); // Gold 15
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
  g.record('correct'); nextWord(g, 1); g.record('wrong'); g.record('correct'); nextWord(g, 0);
  const beforeWin = state(g);
  g.record('correct'); g.undo();
  assert.deepEqual(state(g), beforeWin);
  assert.equal(state(g).phase, 'playing');
});

test('either trailing team can play or pass without spending a turn or points', () => {
  for (const firstTeam of [0, 1]) {
    for (const choice of ['play', 'pass']) {
      const g = game(firstTeam);
      g.record('correct'); g.nextWord();
      const chooser = 1 - firstTeam;
      assert.equal(state(g).phase, 'choice');
      assert.equal(state(g).chooser, chooser);
      assert.equal(g.record('correct'), false, 'a choice is required before recording guesses');
      const scores = state(g).scores;
      assert.equal(g.chooseStart(choice), true);
      assert.equal(state(g).team, choice === 'play' ? chooser : firstTeam);
      assert.equal(state(g).phase, 'playing');
      assert.equal(state(g).value, 6);
      assert.deepEqual(state(g).scores, scores);
      assert.equal(g.chooseStart('play'), false, 'cannot choose again mid-word');
    }
  }
});

test('the team that guesses correctly to tie the scores starts the next word again', () => {
  for (const firstTeam of [0, 1]) {
    const g = game(firstTeam);
    g.record('correct');
    nextWord(g, 1 - firstTeam); g.record('correct');
    assert.deepEqual(state(g).scores, [6, 6]);
    g.nextWord();
    assert.equal(state(g).phase, 'playing');
    assert.equal(state(g).team, 1 - firstTeam);
    assert.equal(g.chooseStart('pass'), false, 'tied teams do not get play/pass');
  }
});

test('exhausted words preserve the last correct team and give the trailing team a fresh choice', () => {
  const g = game();
  g.record('correct'); nextWord(g, 0);
  for (let i = 0; i < 6; i++) g.record('wrong');
  assert.equal(state(g).lastCorrectTeam, 0);
  g.nextWord();
  assert.equal(state(g).phase, 'choice');
  assert.equal(state(g).chooser, 1);
  assert.equal(state(g).value, 6);
});

test('a penalty that ties scores does not replace the last correct team', () => {
  const g = game();
  g.record('correct'); // Gold 6, most recent correct guess.
  for (let i = 0; i < 3; i++) { nextWord(g, 0); g.record('said'); } // Berry 6 via penalties.
  assert.deepEqual(state(g).scores, [6, 6]);
  g.nextWord();
  assert.equal(state(g).team, 0);
  assert.equal(state(g).phase, 'playing');
});

test('undo restores the play/pass choice, secret, scores, and previous word', () => {
  const g = game();
  g.record('correct');
  const completed = state(g);
  g.nextWord();
  const choosing = state(g);
  g.chooseStart('pass'); g.undo();
  assert.deepEqual(state(g), choosing);
  g.chooseStart('play'); g.record('correct'); g.undo(); g.undo();
  assert.deepEqual(state(g), choosing);
  g.undo();
  assert.deepEqual(state(g), completed);
  const snapshot = state(g); snapshot.scores[0] = 999;
  assert.notEqual(state(g).scores[0], 999, 'callers cannot mutate game state');
});
