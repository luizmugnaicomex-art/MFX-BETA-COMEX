import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAxisBrl, formatCompactBrl, formatCompactQty } from './chartFormatters';

test('chartFormatters format compact BRL, axis ticks, and quantities accurately', () => {
  assert.equal(formatCompactBrl(0), '');
  assert.equal(formatCompactBrl(0, true), 'R$ 0');
  assert.equal(formatCompactBrl(10_309_906.51), 'R$ 10,31M');
  assert.equal(formatCompactBrl(283_016), 'R$ 283k');
  assert.equal(formatCompactBrl(12_445), 'R$ 12,4k');
  assert.equal(formatCompactBrl(450), 'R$ 450');

  assert.equal(formatAxisBrl(0), 'R$0');
  assert.equal(formatAxisBrl(3_000_000), 'R$3M');
  assert.equal(formatAxisBrl(140_000), 'R$140k');

  assert.equal(formatCompactQty(0), '');
  assert.equal(formatCompactQty(2400), '2.400');
  assert.equal(formatCompactQty(12500), '12,5k');
});
