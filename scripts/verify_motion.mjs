import assert from 'node:assert/strict';
import { separationAt } from '../web/assembly-motion.js';
assert.equal(separationAt(0), 0);
assert.equal(separationAt(6), 100);
assert.equal(separationAt(12), 0);
for (let t = 0; t <= 12; t += 0.01) {
  const value = separationAt(t);
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
  assert.ok(Math.abs(value - separationAt(12 - t)) < 1e-9);
}
console.log('Assembly replay: bounded, symmetric, assembled endpoints, exploded hold.');
