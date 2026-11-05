export const A_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  parent_run_id TEXT REFERENCES runs(id),
  brief TEXT NOT NULL,
  preset TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  model TEXT NOT NULL,
  thinking TEXT NOT NULL,
  effort TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  cost_usd REAL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  error_code TEXT,
  error_message TEXT,
  workspace_path TEXT NOT NULL,
  summary TEXT,
  snapshot_hash TEXT,
  policy_version_id TEXT,
  trace_complete INTEGER NOT NULL DEFAULT 0,
  run_kind TEXT NOT NULL DEFAULT 'user'
);
CREATE INDEX IF NOT EXISTS ix_runs_created ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_runs_status ON runs(status);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  phase TEXT NOT NULL,
  agent_id TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  input_summary TEXT,
  output_summary TEXT,
  error_code TEXT,
  error_message TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL
);
CREATE INDEX IF NOT EXISTS ix_steps_run ON steps(run_id, seq);

CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_events_run ON events(run_id, seq);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  language TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  agent_id TEXT,
  revised_from TEXT,
  created_at TEXT NOT NULL,
  redaction_status TEXT NOT NULL DEFAULT 'clean',
  redactor_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted',
  mime TEXT
);
CREATE INDEX IF NOT EXISTS ix_artifacts_run ON artifacts(run_id, path);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  verdict TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL,
  mandatory INTEGER NOT NULL DEFAULT 0,
  file TEXT,
  line INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_checks_run ON checks(run_id, check_id);

CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id TEXT,
  agent_id TEXT,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
  cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  system_fingerprint TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_usage_run ON usage(run_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_snapshots (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
  snapshot_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(agent_id, hash)
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(hash)
);

CREATE TABLE IF NOT EXISTS budget_reservations (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  owner_run_id TEXT,
  amount_micro_usd INTEGER NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  committed_micro_usd INTEGER,
  idempotency_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_budget_scope ON budget_reservations(scope, state);
CREATE INDEX IF NOT EXISTS ix_budget_run ON budget_reservations(owner_run_id, state);

CREATE TABLE IF NOT EXISTS gate_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  decision_json TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key_hash TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  body_sha256 TEXT NOT NULL,
  status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_evidence (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  badge TEXT NOT NULL,
  provenance TEXT NOT NULL,
  run_id TEXT,
  evidence_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(agent_id, badge, evidence_hash)
);
CREATE INDEX IF NOT EXISTS ix_agent_evidence ON agent_evidence(agent_id, badge);
`;

export const P6A_SQL = `
CREATE TABLE IF NOT EXISTS route_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  policy_version_id TEXT NOT NULL,
  score REAL NOT NULL,
  rank INTEGER NOT NULL,
  features_json TEXT NOT NULL,
  rejected_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_route_run ON route_decisions(run_id, task_id);

CREATE TABLE IF NOT EXISTS route_candidates (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  model TEXT,
  thinking TEXT,
  effort TEXT,
  chosen INTEGER NOT NULL DEFAULT 0,
  feasible INTEGER NOT NULL,
  reject_reasons_json TEXT NOT NULL,
  quality REAL NOT NULL,
  quality_source TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  est_cost_usd REAL NOT NULL,
  est_latency_ms REAL NOT NULL,
  context_fit REAL NOT NULL,
  risk REAL NOT NULL,
  score REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_stats (
  agent_id TEXT PRIMARY KEY,
  runs INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  median_cost_usd REAL,
  median_latency_ms REAL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_packs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  strategy TEXT NOT NULL,
  included_json TEXT NOT NULL,
  excluded_json TEXT NOT NULL,
  est_tokens INTEGER NOT NULL,
  prefix_hash TEXT NOT NULL,
  converged INTEGER NOT NULL DEFAULT 1,
  degraded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_context_run ON context_packs(run_id, task_id);

CREATE TABLE IF NOT EXISTS context_manifests (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  prefix_hash TEXT NOT NULL,
  included_json TEXT NOT NULL,
  excluded_json TEXT NOT NULL,
  est_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS failure_signatures (
  signature_hash TEXT PRIMARY KEY,
  canonical TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL,
  severity TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_run_id TEXT
);
CREATE TABLE IF NOT EXISTS failure_occurrences (
  id TEXT PRIMARY KEY,
  signature_hash TEXT NOT NULL REFERENCES failure_signatures(signature_hash),
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT,
  file TEXT,
  line INTEGER,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_failure_run ON failure_occurrences(run_id);

CREATE TABLE IF NOT EXISTS verification_plans (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  plan_json TEXT NOT NULL,
  over_budget INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS confidence_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT,
  raw REAL NOT NULL,
  calibrated REAL NOT NULL,
  components_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  threshold REAL NOT NULL,
  provisional INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retry_attempts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  expected_cost_usd REAL NOT NULL,
  expected_value REAL NOT NULL,
  refusal_code TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS script_runs (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL,
  status TEXT NOT NULL,
  exit_code INTEGER,
  envelope_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL
);
`;

export const P7_SQL = `
CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  version INTEGER NOT NULL,
  source TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(scope, version)
);

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
  step_id TEXT,
  agent_id TEXT,
  phase TEXT,
  prompt_version TEXT,
  context_pack_id TEXT,
  policy_version_id TEXT,
  model TEXT NOT NULL,
  thinking TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cache_hit_tokens INTEGER,
  cache_miss_tokens INTEGER,
  reasoning_tokens INTEGER,
  cost_usd REAL,
  latency_ms INTEGER,
  outcome TEXT NOT NULL,
  failure_signature TEXT,
  verifier_json TEXT,
  repair_round INTEGER,
  provenance TEXT NOT NULL,
  redaction_status TEXT NOT NULL,
  user_verdict TEXT,
  edit_distance INTEGER,
  created_at TEXT NOT NULL,
  complete INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_traces_agent ON traces(agent_id, created_at);
CREATE INDEX IF NOT EXISTS ix_traces_complete ON traces(complete, created_at);

CREATE TABLE IF NOT EXISTS repair_memory (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  fix_summary TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  source_trace_id TEXT,
  successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_repair_memory ON repair_memory(signature, status, project_id);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  candidate_family_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  target_agent_id TEXT,
  parent_version_id TEXT,
  baseline_version_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  target_signature TEXT,
  status TEXT NOT NULL,
  hash TEXT NOT NULL,
  safety_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sealed_pool_blocks (
  block_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  dev_count INTEGER NOT NULL DEFAULT 15,
  holdout_count INTEGER NOT NULL DEFAULT 50,
  used_by_suite_id TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sealed_pool (
  case_id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES sealed_pool_blocks(block_id),
  case_index INTEGER NOT NULL,
  source TEXT NOT NULL,
  license TEXT NOT NULL,
  consent_id TEXT,
  captured_at TEXT NOT NULL,
  hash TEXT NOT NULL,
  redaction_scan TEXT NOT NULL,
  UNIQUE(block_id, case_index)
);

CREATE TABLE IF NOT EXISTS eval_suites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  block_id TEXT NOT NULL UNIQUE REFERENCES sealed_pool_blocks(block_id),
  dev_count INTEGER NOT NULL DEFAULT 15,
  holdout_count INTEGER NOT NULL DEFAULT 50,
  metric_id TEXT NOT NULL DEFAULT 'gatePass',
  frozen_at TEXT NOT NULL,
  split_hash TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_cases (
  case_id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES eval_suites(id) ON DELETE CASCADE,
  split TEXT NOT NULL CHECK (split IN ('dev', 'holdout')),
  brief TEXT NOT NULL,
  fixture_json TEXT NOT NULL,
  expected_json TEXT NOT NULL,
  provenance TEXT NOT NULL,
  hash TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  redaction_scan TEXT NOT NULL,
  tombstoned_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_eval_cases_suite ON eval_cases(suite_id, split);

CREATE TABLE IF NOT EXISTS suite_uses (
  suite_use_id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL UNIQUE REFERENCES eval_suites(id),
  suite_version INTEGER NOT NULL,
  block_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  eval_run_id TEXT NOT NULL UNIQUE,
  claimed_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL,
  suite_use_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  baseline_version_id TEXT NOT NULL,
  model TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  total_cost_usd REAL,
  metrics_json TEXT,
  evidence_hash TEXT,
  fingerprint_status TEXT
);

CREATE TABLE IF NOT EXISTS eval_results (
  id TEXT PRIMARY KEY,
  eval_run_id TEXT NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL,
  arm TEXT NOT NULL,
  outcome TEXT NOT NULL,
  checks_json TEXT NOT NULL,
  cost_usd REAL,
  latency_ms INTEGER,
  excluded_reason TEXT
);

CREATE TABLE IF NOT EXISTS approval_tokens (
  jti TEXT PRIMARY KEY,
  token_sha256 TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  candidate_hash TEXT NOT NULL,
  eval_hash TEXT NOT NULL,
  baseline_version_id TEXT NOT NULL,
  suite_use_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  baseline_version_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  alpha_spent REAL,
  approved_by TEXT,
  approved_at TEXT,
  rollback_of TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS post_promotion_monitor (
  promotion_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  window_runs INTEGER NOT NULL DEFAULT 20,
  window_days INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL,
  rolled_back_at TEXT,
  trigger TEXT
);

CREATE TABLE IF NOT EXISTS learning_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  params_json TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS learning_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  before_hash TEXT,
  after_hash TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  rating INTEGER,
  labels_json TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_edits (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  before_hash TEXT NOT NULL,
  after_hash TEXT NOT NULL,
  diff_text TEXT,
  verdict TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

/**
 * B2 live-chat tables. Threads are the durable conversation; jobs are the
 * durable units of agent work; events are the replayable SSE projection.
 * All timestamps are ISO strings (the rest of this database is string-time).
 */
export const CHAT_SQL = `
CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  thinking TEXT NOT NULL,
  effort TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT,
  last_message_preview TEXT,
  last_job_id TEXT,
  last_job_status TEXT
);
CREATE INDEX IF NOT EXISTS ix_chat_threads_updated ON chat_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_chat_threads_status ON chat_threads(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  agent_id TEXT,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  job_id TEXT,
  error_code TEXT,
  error_message TEXT,
  request_key TEXT UNIQUE,
  request_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(thread_id, seq)
);
CREATE INDEX IF NOT EXISTS ix_chat_messages_thread ON chat_messages(thread_id, seq);

CREATE TABLE IF NOT EXISTS chat_jobs (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat.reply',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  lease_owner TEXT,
  lease_expires_at TEXT,
  available_at TEXT NOT NULL,
  cancel_requested_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  cost_usd REAL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_chat_jobs_claim ON chat_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS ix_chat_jobs_lease ON chat_jobs(status, lease_expires_at);
CREATE INDEX IF NOT EXISTS ix_chat_jobs_thread ON chat_jobs(thread_id, created_at);
CREATE INDEX IF NOT EXISTS ix_chat_jobs_message ON chat_jobs(message_id);

CREATE TABLE IF NOT EXISTS chat_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_chat_events_thread ON chat_events(thread_id, seq);
`;

/**
 * Derived, bounded full-text index over a terminal run's published workspace.
 * The ordinary table owns the identity/path and the FTS5 table owns the text.
 * The index is a cache: it can be deleted and rebuilt without changing a run.
 */
export const SEARCH_SQL = `
CREATE TABLE IF NOT EXISTS run_search_docs (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(run_id, path)
);
CREATE INDEX IF NOT EXISTS ix_run_search_docs_run ON run_search_docs(run_id);
CREATE TABLE IF NOT EXISTS run_search_index (
  run_id TEXT PRIMARY KEY,
  workspace_signature TEXT NOT NULL,
  indexed_files INTEGER NOT NULL,
  indexed_at TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS run_search_fts USING fts5(content, tokenize='trigram');
`;

