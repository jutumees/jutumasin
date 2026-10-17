const {test} = require('node:test');
const assert = require('node:assert/strict');
const AdCadence = require('../ad-cadence.js');
test('ads alternate after 3 and 4 new question cards', () => {
  const cadence = new AdCadence();
  const ads = [];
  for(let i=0;i<21;i++) if(cadence.complete(i)) ads.push(i + 1);
  assert.deepEqual(ads, [3,7,10,14,17,21]);
});
test('backtracking cannot inflate cadence; deck switches retain count', () => {
  const cadence = new AdCadence();
  cadence.complete(0); cadence.complete(1);
  assert.equal(cadence.complete(0), false);
  assert.equal(cadence.complete(1), false);
  cadence.newDeck();
  assert.equal(cadence.complete(0), true);
});
test('cadence survives app restart', () => {
  const cadence = new AdCadence();
  cadence.complete(0); cadence.complete(1);
  const restored = new AdCadence(JSON.parse(JSON.stringify(cadence)));
  assert.equal(restored.complete(2), true);
  assert.equal(restored.interval, 4);
});

test('after five minutes ads continue every five to six new questions across restarts', () => {
  const cadence = new AdCadence();
  cadence.addPlayTime(300000);
  const ads=[];
  for(let i=0;i<22;i++) if(cadence.complete(i)) ads.push(i+1);
  assert.deepEqual(ads,[5,11,16,22]);
  const restored = new AdCadence(JSON.parse(JSON.stringify(cadence)));
  assert.equal(restored.activeMs,300000);
  restored.newDeck();
  for(let i=0;i<4;i++) assert.equal(restored.complete(i),false);
  assert.equal(restored.complete(4),true);
});
