import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, buildModel, SAMPLE_SCENARIOS } from '../src/engine.js';

test('deterministic synthetic model', () => {
  const a = buildModel(), b = buildModel();
  assert.equal(a.reference.length, 240);
  assert.deepEqual(a, b);
});
test('baseline routine access is trusted', () => {
  const result = assess(SAMPLE_SCENARIOS.normal);
  assert.equal(result.decision, 'ALLOW');
  assert.ok(result.trustScore >= 75);
});
test('high-risk access is blocked', () => {
  const result = assess(SAMPLE_SCENARIOS.critical);
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.trustScore < 45);
});
test('increasing signals does not improve trust in these reference scenarios', () => {
  const normal = assess(SAMPLE_SCENARIOS.normal);
  const suspicious = assess(SAMPLE_SCENARIOS.suspicious);
  const critical = assess(SAMPLE_SCENARIOS.critical);
  assert.ok(normal.trustScore >= suspicious.trustScore);
  assert.ok(suspicious.trustScore >= critical.trustScore);
});
test('scores are bounded and explanations exist', () => {
  for (const scenario of Object.values(SAMPLE_SCENARIOS)) {
    const result = assess(scenario);
    for (const key of ['trustScore', 'riskScore', 'anomalyScore', 'policyScore']) {
      assert.ok(result[key] >= 0 && result[key] <= 100);
    }
    assert.equal(result.trustScore + result.riskScore, 100);
    assert.ok(result.explanation.length);
  }
});
