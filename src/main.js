import { assess, SAMPLE_SCENARIOS } from './engine.js';

const $ = (id) => document.getElementById(id);
const fields = ['hour', 'failures', 'requestsPerMinute', 'outboundMB', 'geoNovelty', 'deviceRisk'];
let currentScenario = 'normal';
let lastAssessment = null;

function formatField(id, value) {
  if (id === 'geoNovelty' || id === 'deviceRisk') return `${Math.round(value * 100)}%`;
  if (id === 'hour') return `${String(Math.round(value)).padStart(2, '0')}:00`;
  if (id === 'outboundMB') return `${Math.round(value)} MB`;
  if (id === 'requestsPerMinute') return `${Math.round(value)} / min`;
  return String(Math.round(value));
}
function setInputs(values) {
  for (const id of fields) $(id).value = values[id];
  $('sensitiveResource').checked = values.sensitiveResource;
  render();
}
function readInputs() {
  return Object.fromEntries(fields.map((id) => [id, Number($(id).value)]).concat([
    ['sensitiveResource', $('sensitiveResource').checked],
  ]));
}
function render() {
  for (const id of fields) $(`${id}Value`).textContent = formatField(id, Number($(id).value));
  const result = assess(readInputs());
  lastAssessment = result;
  $('trustValue').textContent = result.trustScore;
  $('riskValue').textContent = result.riskScore;
  $('anomalyValue').textContent = result.anomalyScore;
  $('policyValue').textContent = result.policyScore;
  $('anomalyBar').style.width = `${result.anomalyScore}%`;
  $('policyBar').style.width = `${result.policyScore}%`;
  $('gauge').style.setProperty('--score', result.trustScore);

  const descriptions = {
    ALLOW: 'Access granted under baseline controls.',
    'STEP-UP': 'Require stronger verification before access.',
    BLOCK: 'Access denied pending security review.',
  };
  const decision = $('decision');
  decision.className = `decision ${result.decision.toLowerCase()}`;
  decision.textContent = result.decision === 'STEP-UP' ? 'STEP-UP MFA' : result.decision;
  $('decisionDetail').textContent = descriptions[result.decision];
  const list = $('signalList');
  list.replaceChildren();
  const indicators = result.indicators.length ? result.indicators.slice(0, 5) : [{title:'No major policy flags',detail:'Current context resembles routine access',impact:0}];
  for (const entry of indicators) {
    const line = document.createElement('li');
    line.className = 'signal';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const detail = document.createElement('span');
    detail.textContent = entry.detail;
    copy.append(title, detail);
    const value = document.createElement('b');
    value.textContent = `+${Math.round(entry.impact)}`;
    line.append(copy, value);
    list.append(line);
  }
  $('generatedTime').textContent = new Date().toLocaleString('en-GB', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short',year:'numeric'});
}
function chooseScenario(key) {
  currentScenario = key;
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    const active = button.dataset.scenario === key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  setInputs(SAMPLE_SCENARIOS[key]);
}
for (const id of fields) $(id).addEventListener('input', () => {
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.classList.remove('active'); button.setAttribute('aria-pressed', 'false');
  });
  currentScenario = 'custom';
  render();
});
$('sensitiveResource').addEventListener('change', render);
document.querySelectorAll('[data-scenario]').forEach((button) => button.addEventListener('click', () => chooseScenario(button.dataset.scenario)));
$('exportButton').addEventListener('click', () => {
  const output = {
    title: 'Adaptive Zero Trust – demo assessment',
    exportedAt: new Date().toISOString(),
    selectedScenario: currentScenario,
    ...lastAssessment,
    disclaimer: 'Synthetic demonstration. Risk scores are heuristic, not calibrated probabilities. Not intended for deployment.',
  };
  const blob = new Blob([JSON.stringify(output, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `zero-trust-assessment-${currentScenario}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});
chooseScenario('normal');
