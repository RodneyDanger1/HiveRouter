import fs from 'node:fs';
const p = 'docs/AUDIT-WAVE-6/weaver/controls.json';
const c = JSON.parse(fs.readFileSync(p, 'utf8'));
const runTabs = JSON.parse(fs.readFileSync('docs/AUDIT-WAVE-6/weaver/evidence/browser/run-detail-controls.json', 'utf8'));
const learning = JSON.parse(fs.readFileSync('docs/AUDIT-WAVE-6/weaver/evidence/browser/learning.json', 'utf8'));
c.tabs = {
  note: 'Tab widgets are counted inside page/run-detail controls; this section indexes their identity, state and keyboard/a11y evidence.',
  shellNav: c.shell.controls,
  runDetail: {
    render: 'web/src/pages/RunDetailPage.tsx:79-88,392-394; web/src/components/ui.tsx:333-371',
    count: 8,
    items: runTabs['run-abf5'].a11y.tabs.map((t) => ({ label: t.text, ariaSelected: t.ariaSelected, tabIndex: t.tabIndex, disabled: t.disabled, ariaControls: t.ariaControls })),
    keyboard: { ArrowRight: 'Events -> Overview (wrap)', ArrowLeft: 'implemented at ui.tsx:354-366', HomeEnd: 'not implemented' },
    panel: runTabs['run-abf5'].a11y.tabpanel,
    defect: 'F9: no aria-controls on tabs; no id/aria-labelledby on the tabpanel',
    evidence: ['evidence/browser/run-detail-controls.json#a11y', 'evidence/browser/run-abf5-detail.json#keyboard'],
  },
  learning: {
    render: 'web/src/pages/LearningPage.tsx:52-61,167-172',
    count: 8,
    items: learning.learning.tabs.map((t) => ({ label: t.text, disabled: t.disabled, ariaDisabled: t.ariaDisabled, hint: 'Learning is unavailable: sealed pool exhausted.' })),
    state: 'all disabled; REFUSED-BY-NAME E_LEARNING_POOL_EXHAUSTED',
    evidence: ['evidence/browser/learning.json'],
  },
  totalTabControls: 16,
};
fs.writeFileSync(p, JSON.stringify(c, null, 2), 'utf8');
console.log('tabs added', c.tabs.runDetail.count + c.tabs.learning.count, 'bytes', fs.statSync(p).size);
