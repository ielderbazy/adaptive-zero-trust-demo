/**
 * Adaptive Zero Trust risk demonstrator.
 * A tiny, deterministic distance-based anomaly detector (k-nearest neighbours)
 * fit on synthetic normal events, combined with transparent policy checks.
 * No real security telemetry is processed and scores are not probabilities.
 */

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** These units and ranges are pedagogical, not production-calibrated. */
function generateBaseline(count = 240, seed = 2026) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    hour: 8 + random() * 11,
    failures: random() < 0.88 ? 0 : 1,
    requestsPerMinute: 5 + random() * 30,
    outboundMB: random() * 65,
    geoNovelty: random() * 0.16,
    deviceRisk: random() * 0.17,
  }));
}

const WEIGHTS = [1.1, 1.3, 1.2, 1.0, 1.5, 1.5];
function toFeatures(v) {
  return [
    (Number(v.hour) - 12) / 8,
    Number(v.failures) / 3,
    Number(v.requestsPerMinute) / 65,
    Number(v.outboundMB) / 125,
    Number(v.geoNovelty),
    Number(v.deviceRisk),
  ];
}
function distance(a, b) {
  const x = toFeatures(a), y = toFeatures(b);
  return Math.sqrt(x.reduce((acc, v, i) => acc + WEIGHTS[i] * (v - y[i]) ** 2, 0));
}
function knnDistance(event, reference, k = 5, omit = -1) {
  const dists = [];
  for (let i = 0; i < reference.length; i++) {
    if (i !== omit) dists.push(distance(event, reference[i]));
  }
  dists.sort((a, b) => a - b);
  return dists.slice(0, k).reduce((a, b) => a + b, 0) / k;
}
function percentile(sortedValues, q) {
  const index = (sortedValues.length - 1) * q;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

export function buildModel() {
  const baseline = generateBaseline();
  const localDistances = baseline.map((e, i) => knnDistance(e, baseline, 5, i)).sort((a, b) => a - b);
  return {
    reference: baseline,
    threshold75: percentile(localDistances, 0.75),
    threshold99: percentile(localDistances, 0.99),
    method: '5-NN distance compared with synthetic normal baseline',
  };
}
const DEFAULT_MODEL = buildModel();

/**
 * event: {hour, failures, requestsPerMinute, outboundMB,
 * geoNovelty: 0..1, deviceRisk: 0..1, sensitiveResource: boolean}
 */
export function assess(event, model = DEFAULT_MODEL) {
  const e = {
    hour: clamp(Number(event.hour) || 0, 0, 23),
    failures: clamp(Number(event.failures) || 0, 0, 12),
    requestsPerMinute: clamp(Number(event.requestsPerMinute) || 0, 0, 500),
    outboundMB: clamp(Number(event.outboundMB) || 0, 0, 1000),
    geoNovelty: clamp(Number(event.geoNovelty) || 0, 0, 1),
    deviceRisk: clamp(Number(event.deviceRisk) || 0, 0, 1),
    sensitiveResource: Boolean(event.sensitiveResource),
  };

  const rawDistance = knnDistance(e, model.reference);
  const anomalyScore = round(clamp(
    100 * (rawDistance - model.threshold75) /
    Math.max(model.threshold99 - model.threshold75, 0.01)
  ));
  const afterHours = e.hour < 7 || e.hour > 21;
  const indicators = [
    { key: 'failed-logins', title: 'Failed login attempts', detail: `${e.failures} recent failures`, impact: clamp(e.failures * 10, 0, 30) },
    { key: 'location', title: 'Unfamiliar location', detail: `${round(e.geoNovelty * 100)}% novelty signal`, impact: e.geoNovelty * 24 },
    { key: 'device', title: 'Device posture', detail: `${round(e.deviceRisk * 100)}% device risk`, impact: e.deviceRisk * 24 },
    { key: 'traffic', title: 'Request volume', detail: `${round(e.requestsPerMinute)} requests/min`, impact: clamp((e.requestsPerMinute - 45) / 6, 0, 18) },
    { key: 'outbound', title: 'Outbound data volume', detail: `${round(e.outboundMB)} MB`, impact: clamp((e.outboundMB - 100) / 12, 0, 20) },
    { key: 'time', title: 'Access outside usual hours', detail: afterHours ? 'Outside 07:00–21:00' : 'Within usual hours', impact: afterHours ? 12 : 0 },
    { key: 'resource', title: 'Resource sensitivity', detail: e.sensitiveResource ? 'Sensitive target' : 'Standard target', impact: e.sensitiveResource ? 8 : 0 },
  ];

  const policyScore = round(clamp(indicators.reduce((sum, signal) => sum + signal.impact, 0)));
  const riskScore = round(clamp(0.64 * anomalyScore + 0.36 * policyScore));
  const trustScore = 100 - riskScore;
  const decision = trustScore >= 75 ? 'ALLOW' : trustScore >= 45 ? 'STEP-UP' : 'BLOCK';
  const ranked = indicators.filter((s) => s.impact > 0).sort((a, b) => b.impact - a.impact);

  return {
    event: e,
    trustScore,
    riskScore,
    anomalyScore,
    policyScore,
    decision,
    indicators: ranked,
    explanation: ranked.length
      ? ranked.slice(0, 3).map((s) => s.title)
      : ['No elevated policy indicators'],
    meta: {
      referenceCount: model.reference.length,
      knn: 5,
      rawDistance: Number(rawDistance.toFixed(4)),
      modelType: 'K-nearest-neighbour baseline anomaly detection',
      dataSource: 'Synthetic events; educational demonstration only',
    },
  };
}

export const SAMPLE_SCENARIOS = Object.freeze({
  normal: {
    label: 'Routine access',
    hour: 11, failures: 0, requestsPerMinute: 18, outboundMB: 15,
    geoNovelty: 0.04, deviceRisk: 0.05, sensitiveResource: false,
  },
  suspicious: {
    label: 'Unusual session',
    hour: 16, failures: 1, requestsPerMinute: 28, outboundMB: 50,
    geoNovelty: 0.13, deviceRisk: 0.13, sensitiveResource: true,
  },
  critical: {
    label: 'High-risk access',
    hour: 3, failures: 8, requestsPerMinute: 280, outboundMB: 650,
    geoNovelty: 0.95, deviceRisk: 0.92, sensitiveResource: true,
  },
});
