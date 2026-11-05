/**
 * Provenance for every base prompt.
 *
 * CATALOG: role/objective/constraints adapted from the supplied agent
 * specification catalog (output-format regions intentionally removed; the
 * runtime contract is appended at request time).
 *
 * AUTHORED: the catalog supplied only one-line briefs for the six operational
 * field workers, so their prompts were authored here and reviewed against the
 * catalog's stated responsibilities.
 */
import type { AgentId } from '../../shared/types';

export type PromptSource = 'CATALOG' | 'AUTHORED';

export interface PromptSourceMeta {
  source: PromptSource;
  sourceRef: string;
}

export const AGENT_SOURCES: Record<AgentId, PromptSourceMeta> = {
  router: { source: 'CATALOG', sourceRef: 'catalog §4.1 The Master Router & Orchestrator' },
  architect: { source: 'CATALOG', sourceRef: 'catalog §4.2 The System Architect & Orchestrator' },
  metacognitive: { source: 'CATALOG', sourceRef: 'catalog §4.3 The Metacognitive Compiler' },
  epic: { source: 'CATALOG', sourceRef: 'catalog §4.4 The Epic Epicenter' },
  cartographer: { source: 'CATALOG', sourceRef: 'catalog §4.5 The Dependency Cartographer' },
  'structural-engine': { source: 'CATALOG', sourceRef: 'catalog §5.1 General Structural Engine' },
  'python-engine': { source: 'CATALOG', sourceRef: 'catalog §5.1 Python Edition' },
  'polyglot-engine': { source: 'CATALOG', sourceRef: 'catalog §5.2 The Polyglot Engine' },
  'js-engine': { source: 'CATALOG', sourceRef: 'catalog §5.3 The JS Structural Engine' },
  'ts-engine': { source: 'CATALOG', sourceRef: 'catalog §5.4 The TypeScript Validation Engine' },
  'baremetal-engine': { source: 'CATALOG', sourceRef: 'catalog §5.5 The Bare-Metal Engine' },
  'algorithm-engine': { source: 'CATALOG', sourceRef: 'catalog §5.6 The Algorithm Engine' },
  'html-engine': { source: 'CATALOG', sourceRef: 'catalog §6.1 The HTML Structural Engine' },
  'react-engine': { source: 'CATALOG', sourceRef: 'catalog §6.2 The React Component Engine' },
  'tailwind-engine': { source: 'CATALOG', sourceRef: 'catalog §6.3 The Tailwind Utility Engine' },
  'threejs-engine': { source: 'CATALOG', sourceRef: 'catalog §6.4 The Three.js Engine' },
  'nds-engine': { source: 'CATALOG', sourceRef: 'catalog §6.5 The NDS Frontend Component Engine' },
  'powershell-core': { source: 'CATALOG', sourceRef: 'catalog §7.1 PS-Core' },
  'powershell-api': { source: 'CATALOG', sourceRef: 'catalog §7.1 PS-API' },
  'powershell-diagnostics': { source: 'CATALOG', sourceRef: 'catalog §7.1 PS-Diagnostics' },
  'cmd-engine': { source: 'CATALOG', sourceRef: 'catalog §7.2 The Windows Native Engine' },
  'bash-engine': { source: 'CATALOG', sourceRef: 'catalog §7.3 The UNIX Core Engine' },
  'schema-engine': { source: 'CATALOG', sourceRef: 'catalog §8.1 The Schema Engine' },
  'sql-engine': { source: 'CATALOG', sourceRef: 'catalog §8.2 The Relational Schema Engine' },
  'yaml-engine': { source: 'CATALOG', sourceRef: 'catalog §8.3 The Configuration Engine' },
  'symbolic-logic-engine': { source: 'CATALOG', sourceRef: 'catalog §8.4 The Symbolic Logic Generator' },
  'markdown-engine': { source: 'CATALOG', sourceRef: 'catalog §8.5 The Markdown Cartographer' },
  cleaner: { source: 'CATALOG', sourceRef: 'catalog §9.1 The Code Cleaner & Refactorer' },
  sentinel: { source: 'CATALOG', sourceRef: 'catalog §9.2 The Sentinel' },
  watchman: { source: 'CATALOG', sourceRef: 'catalog §9.3 The Watchman' },
  gatekeeper: { source: 'CATALOG', sourceRef: 'catalog §9.4 The Gatekeeper' },
  'gitops-engine': { source: 'AUTHORED', sourceRef: 'AUTHORED plan v3 §3 row 32 (GitOps Release Manager)' },
  'sandbox-engine': { source: 'AUTHORED', sourceRef: 'AUTHORED plan v3 §3 row 33 (Sandbox Supervisor)' },
  'package-engine': { source: 'AUTHORED', sourceRef: 'AUTHORED plan v3 §3 row 34 (Package Optimizer & Bundler)' },
  'live-monitor-engine': { source: 'AUTHORED', sourceRef: 'AUTHORED plan v3 §3 row 35 (Live State Monitor)' },
  'db-janitor-engine': { source: 'AUTHORED', sourceRef: 'AUTHORED plan v3 §3 row 36 (Database Janitor)' },
  'harvester-engine': { source: 'AUTHORED', sourceRef: 'AUTHORED plan v3 §3 row 37 (Web Scraper & Ingestion Miner)' },
};
