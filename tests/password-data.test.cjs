const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('js/password-data.js', 'utf8');
const bank = JSON.parse(fs.readFileSync('password-words.json', 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
function setup(responses = [bank]) {
  const requests = [];
  let responseNumber = 0;
  const context = vm.createContext({
    fetch: async (url) => {
      requests.push(url);
      const value = responses[Math.min(responseNumber++, responses.length - 1)];
      if (value instanceof Error) throw value;
      return { ok: true, json: async () => clone(value) };
    }
  });
  vm.runInContext(source + '\nthis.data = PasswordData;', context);
  return { data: context.data, requests, context };
}

test('Password loads its own bank once, including concurrent loads, without fetching French Toast', async () => {
  const { data, requests } = setup();
  assert.equal(data.counts(), null);
  assert.equal(data.drawWord('basic'), '');
  await Promise.all([data.load(), data.load(), data.load()]);
  await data.load();
  assert.deepEqual(requests, ['./password-words.json']);
  for (const deck of ['basic', 'advanced']) {
    const expected = Object.values(bank.decks[deck]).flat();
    assert.equal(data.counts()[deck], expected.length);
    assert.ok(expected.includes(data.drawWord(deck)));
  }
  assert.equal(data.drawWord('unknown'), '');
});

test('every word is dealt once before reshuffling, including later cycles', async () => {
  const { data, context } = setup();
  vm.runInContext('Math.random = () => 0;', context);
  await data.load();
  for (const deck of ['basic', 'advanced']) {
    const expected = Object.values(bank.decks[deck]).flat();
    let last = '';
    for (let cycle = 0; cycle < 3; cycle++) {
      const drawn = Array.from({ length: expected.length }, () => data.drawWord(deck));
      assert.equal(new Set(drawn).size, expected.length);
      assert.deepEqual(drawn.slice().sort(), expected.slice().sort());
      assert.notEqual(drawn[0], last, 'reshuffle cannot immediately repeat the last word');
      last = drawn.at(-1);
    }
  }
});

test('switching decks and returning keeps each deck\'s no-repeat history', async () => {
  const { data } = setup();
  await data.load();
  const first = data.drawWord('basic');
  data.drawWord('advanced');
  await data.load();
  const rest = Array.from({length:data.counts().basic - 1}, () => data.drawWord('basic'));
  assert.equal(rest.includes(first), false);
  assert.equal(new Set(rest).size, rest.length);
});

test('invalid entries fail to load rather than showing unusable words', async () => {
  const malformed = [];
  const duplicate = clone(bank);
  duplicate.decks.advanced.verbs[0] = duplicate.decks.basic.nouns[0];
  malformed.push(duplicate);
  for (const entry of ['two words', 'Capital', '', 42]) {
    const value = clone(bank); value.decks.basic.verbs[0] = entry; malformed.push(value);
  }
  const empty = clone(bank); empty.decks.advanced.adjectives = []; malformed.push(empty);
  for (const value of malformed) {
    const { data } = setup([value]);
    await assert.rejects(data.load(), /Password/);
    assert.equal(data.counts(), null);
    assert.equal(data.drawWord('basic'), '');
  }
});

test('a failed fetch can be retried without retaining a rejected load', async () => {
  const { data, requests } = setup([new Error('offline'), bank]);
  await assert.rejects(data.load(), /offline/);
  await data.load();
  assert.ok(data.drawWord('basic'));
  assert.equal(requests.length, 2);
});
