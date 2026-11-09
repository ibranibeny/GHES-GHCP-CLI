import test from 'node:test';
import assert from 'node:assert/strict';
import { totalBeforeReview, totalAfterReview } from '../demo/pricing.mjs';

test('illustrative bug and fix: a 10% discount on 2 x 100 is 180, not 190', () => {
  assert.equal(totalBeforeReview(100, 2, 10), 190);
  assert.equal(totalAfterReview(100, 2, 10), 180);
});
test('discount boundaries and currency rounding', () => {
  assert.equal(totalAfterReview(100, 2, 0), 200);
  assert.equal(totalAfterReview(100, 2, 100), 0);
  assert.equal(totalAfterReview(19.99, 3, 10), 53.97);
});
test('invalid values raise explicit errors', () => {
  for (const args of [[-1, 1, 0], [NaN, 1, 0], [1, 0, 0], [1, 1.5, 0], [1, 1, -1], [1, 1, 101], [Infinity, 1, 0], [1, 1, NaN], [Number.MAX_VALUE, 2, 0]]) {
    assert.throws(() => totalAfterReview(...args), RangeError);
  }
});
