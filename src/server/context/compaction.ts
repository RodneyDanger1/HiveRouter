/**
 * Filename: src/server/context/compaction.ts
 * Dependencies: node:crypto (via shared sha256Hex)
 * Run: unit-tested by test/unit/compaction.test.ts
 *
 * Evidence-preserving conversational compaction.
 *
 * This is a pure, all-or-nothing transform. It removes only clearly
 * conversational filler lines. Any protected block, mandatory snippet, or
 * malformed construct makes the function return the original input untouched
 * with a named refusal instead of silently dropping evidence.
 */

import { sha256Hex } from '../../shared/algorithms';

export const COMPACTION_REFUSAL_CODES = [
  'E_COMPACTION_INPUT_INVALID',
  'E_COMPACTION_INPUT_TOO_LARGE',
  'E_COMPACTION_INVALID_OPTIONS',
  'E_COMPACTION_UNCLOSED_BLOCK',
  'E_COMPACTION_MALFORMED_MARKER',
  'E_COMPACTION_MANDATORY_MISSING',
  'E_COMPACTION_PRESERVATION',
  'E_COMPACTION_OUTPUT_TOO_LARGE',
] as const;

export type CompactionRefusalCode = (typeof COMPACTION_REFUSAL_CODES)[number];

export interface CompactionRefusal {
  code: CompactionRefusalCode;
  message: string;
  details: Record<string, unknown>;
}

export interface CompactEvidenceOptions {
  /** Maximum successful output length in characters. Default 32,000. */
  maxChars?: number;
  /** Maximum input length accepted for processing. Default 200,000. */
  maxInputChars?: number;
  /** Exact snippets that must survive; missing snippets are a refusal. */
  mandatory?: readonly string[];
}

export interface CompactionResult {
  compacted: string;
  removedChars: number;
  preservedBlocks: number;
  pointer: string | null;
  truncated: boolean;
  refusal?: CompactionRefusal;
}

const DEFAULT_MAX_CHARS = 32_000;
const DEFAULT_MAX_INPUT_CHARS = 200_000;
const MAX_MANDATORY_ITEMS = 100;
const MAX_PROTECTED_LINES = 5_000;

interface Range {
  start: number;
  end: number;
  kind: string;
}

const FENCE_OPEN = /^\s*(`{3,}|~{3,})([^`~]*)$/;
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
const KEEP_OPEN_STANDALONE = /^\s*\[\[KEEP:([^\]\r\n]+)\]\]\s*$/;
const KEEP_INVALID = /^\s*\[\[KEEP:\s*\]\]\s*$/;
const KEEP_CLOSE = /^\s*\[\[\/KEEP\]\]\s*$/;
const KEEP_ANY = /\[\[KEEP:[^\]\r\n]+\]\]/;

const TYPE_START = /^\s*(?:export\s+)?(?:type|interface|enum|class|schema)\b/;
const CONTRACT_START = /^\s*(?:contract|api|input|output|request|response)\s*[:=]/i;
const JSON_SCHEMA_KEY = /^\s*["']?(?:type|properties|required|additionalProperties|items|enum|oneOf|anyOf|allOf)["']?\s*:/;
const STRUCTURAL_ONLY = /^\s*[{}[\],;]+\s*$/;

const PATH_EVIDENCE =
  /(?:\b(?:src|tests?|test|docs?|workspace|vault|web|scripts|config|data)[\\/][^\s`"'<>|]+|(?:[A-Za-z]:\\[^\s`"'<>|]+)|[A-Za-z0-9_.-]+\.(?:py|ts|tsx|js|jsx|mjs|cjs|json|sql|ya?ml|md|ps1|cmd|bat|sh|rs|cpp|cc|c|h|hpp|go|java|cs|rb|swift|php)\b)/i;
const CHECK_EVIDENCE =
  /\b(?:check(?:Id|s)?|mandatory|secret\.scan|stub\.scan|plan\.coverage|syntax\.[a-z0-9]+|verified?|status)\s*[:=]/i;
const HASH_EVIDENCE = /\b(?:sha256:)?[a-f0-9]{16,64}\b/i;
const EVIDENCE_PREFIX =
  /^\s*(?:evidence|path|file|line|check|checkId|status|result|contract|api|input|output|request|response|type|interface|schema)\s*[:=]/i;

const FILLER_PATTERNS = [
  /^(?:sure|certainly|of course|absolutely|great|happy to help|i'?d be happy|i can|i'?ll|let me|here'?s|here is|below is|as an ai|hope (?:this|that) helps|feel free|let me know|would you like|in summary|to summarize|quick note|note that|thanks|thank you|okay|ok)\b/i,
  /^(?:this|that|it) (?:should|will|would|can|may) (?:help|work|be|do)\b/i,
  /^(?:the )?(?:next|following) (?:step|steps) (?:is|are)\b/i,
  /^(?:if you (?:want|need|like)|you can (?:also|now))\b/i,
  /^(?:that'?s|that is) (?:all|it)\b/i,
];

function refusal(input: string, code: CompactionRefusalCode, message: string, details: Record<string, unknown> = {}): CompactionResult {
  return {
    compacted: input,
    removedChars: 0,
    preservedBlocks: 0,
    pointer: null,
    truncated: false,
    refusal: { code, message, details },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      if (last.kind !== range.kind) last.kind = `${last.kind}+${range.kind}`;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function splitLines(input: string): string[] {
  return input.split('\n');
}

function isFenceClose(line: string, char: string, length: number): boolean {
  const match = FENCE_CLOSE.exec(line);
  if (!match) return false;
  const marker = match[1];
  return marker[0] === char && marker.length >= length;
}

function balancedEnd(lines: string[], start: number): number {
  let depth = 0;
  let sawOpen = false;
  let end = start;
  const limit = Math.min(lines.length, start + 300);
  for (let index = start; index < limit; index += 1) {
    const line = lines[index];
    for (const char of line) {
      if (char === '{' || char === '[') {
        depth += 1;
        sawOpen = true;
      } else if (char === '}' || char === ']') {
        depth = Math.max(0, depth - 1);
      }
    }
    if (index === start) {
      end = index;
      if (depth > 0) continue;
      const next = lines[index + 1]?.trim() ?? '';
      if (next.startsWith('{') || next.startsWith('[')) {
        // The declaration wraps its body on the next line.
        continue;
      }
      return end;
    }
    end = index;
    if (sawOpen && depth === 0) return end;
    if (!sawOpen && line.trim().length === 0) return start;
  }
  return end;
}

function isEvidenceLine(line: string): boolean {
  return (
    PATH_EVIDENCE.test(line) ||
    CHECK_EVIDENCE.test(line) ||
    HASH_EVIDENCE.test(line) ||
    EVIDENCE_PREFIX.test(line) ||
    TYPE_START.test(line) ||
    CONTRACT_START.test(line) ||
    JSON_SCHEMA_KEY.test(line) ||
    STRUCTURAL_ONLY.test(line)
  );
}

function isEligibleConversational(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  if (isEvidenceLine(line)) return false;
  return FILLER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function lineIndexAt(offsets: number[], position: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= position && (middle === offsets.length - 1 || offsets[middle + 1] > position)) {
      return middle;
    }
    if (offsets[middle] > position) high = middle - 1;
    else low = middle + 1;
  }
  return Math.max(0, Math.min(offsets.length - 1, low));
}

function mandatoryRanges(input: string, lines: string[], mandatory: readonly string[]): Range[] | CompactionRefusal {
  const offsets: number[] = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);
  const ranges: Range[] = [];
  for (const snippet of mandatory) {
    if (typeof snippet !== 'string' || snippet.length === 0) {
      return {
        code: 'E_COMPACTION_INVALID_OPTIONS',
        message: 'mandatory entries must be non-empty strings',
        details: {},
      };
    }
    let from = 0;
    let found = false;
    while (from <= input.length) {
      const at = input.indexOf(snippet, from);
      if (at < 0) break;
      found = true;
      const startLine = lineIndexAt(offsets, at);
      const endLine = lineIndexAt(offsets, at + snippet.length - 1);
      ranges.push({ start: startLine, end: endLine, kind: 'mandatory' });
      from = at + Math.max(1, snippet.length);
    }
    if (!found) {
      return {
        code: 'E_COMPACTION_MANDATORY_MISSING',
        message: 'mandatory snippet is not present in the input',
        details: { snippet: snippet.slice(0, 80) },
      };
    }
  }
  return ranges;
}

/**
 * Compact conversational evidence. Successful output is always <= maxChars and
 * always contains every protected range and mandatory snippet. On refusal the
 * original input is returned byte-for-byte unchanged.
 */
export function compactEvidence(input: string, options: CompactEvidenceOptions = {}): CompactionResult {
  if (typeof input !== 'string') {
    return refusal('', 'E_COMPACTION_INPUT_INVALID', 'input must be a string', {});
  }
  const rawOptions: unknown = options;
  if (!isPlainObject(rawOptions)) {
    return refusal(input, 'E_COMPACTION_INVALID_OPTIONS', 'options must be an object', {});
  }
  const config = rawOptions as CompactEvidenceOptions;
  const maxChars = config.maxChars === undefined ? DEFAULT_MAX_CHARS : config.maxChars;
  const maxInputChars = config.maxInputChars === undefined ? DEFAULT_MAX_INPUT_CHARS : config.maxInputChars;
  const rawMandatory = config.mandatory;
  if (rawMandatory !== undefined && !Array.isArray(rawMandatory)) {
    return refusal(input, 'E_COMPACTION_INVALID_OPTIONS', 'mandatory must be an array', {});
  }
  if (Array.isArray(rawMandatory) && rawMandatory.some((value) => typeof value !== 'string')) {
    return refusal(input, 'E_COMPACTION_INVALID_OPTIONS', 'mandatory entries must be strings', {});
  }
  const mandatory: readonly string[] = Array.isArray(rawMandatory) ? rawMandatory : [];
  if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > DEFAULT_MAX_INPUT_CHARS) {
    return refusal(input, 'E_COMPACTION_INVALID_OPTIONS', 'maxChars must be a positive integer <= 200000', { maxChars });
  }
  if (!Number.isInteger(maxInputChars) || maxInputChars < 1 || maxInputChars > DEFAULT_MAX_INPUT_CHARS) {
    return refusal(input, 'E_COMPACTION_INVALID_OPTIONS', 'maxInputChars must be a positive integer <= 200000', { maxInputChars });
  }
  if (mandatory.length > MAX_MANDATORY_ITEMS) {
    return refusal(input, 'E_COMPACTION_INVALID_OPTIONS', `mandatory must contain at most ${MAX_MANDATORY_ITEMS} snippets`, {});
  }
  if (input.length > maxInputChars) {
    return refusal(input, 'E_COMPACTION_INPUT_TOO_LARGE', 'input exceeds maxInputChars', { inputChars: input.length, maxInputChars });
  }

  const lines = splitLines(input);
  const ranges: Range[] = [];
  let inFence = false;
  let fenceChar = '';
  let fenceLength = 0;
  let fenceStart = -1;
  let inKeep = false;
  let keepStart = -1;

  const add = (start: number, end: number, kind: string): void => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= lines.length) return;
    ranges.push({ start, end, kind });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (inFence) {
      if (isFenceClose(line, fenceChar, fenceLength)) {
        add(fenceStart, index, 'fence');
        inFence = false;
      }
      continue;
    }

    if (inKeep) {
      if (KEEP_CLOSE.test(line)) {
        add(keepStart, index, 'keep');
        inKeep = false;
      } else if (KEEP_OPEN_STANDALONE.test(line)) {
        return refusal(input, 'E_COMPACTION_MALFORMED_MARKER', 'nested KEEP block', { line: index + 1 });
      }
      continue;
    }

    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      inFence = true;
      fenceChar = fence[1][0];
      fenceLength = fence[1].length;
      fenceStart = index;
      continue;
    }

    if (KEEP_INVALID.test(line)) {
      return refusal(input, 'E_COMPACTION_MALFORMED_MARKER', 'KEEP marker has no label', { line: index + 1 });
    }
    const keep = KEEP_OPEN_STANDALONE.exec(line);
    if (keep) {
      inKeep = true;
      keepStart = index;
      continue;
    }
    if (KEEP_CLOSE.test(line)) {
      return refusal(input, 'E_COMPACTION_MALFORMED_MARKER', 'KEEP close without an open marker', { line: index + 1 });
    }
    if (KEEP_ANY.test(line)) {
      add(index, index, 'keep-inline');
      continue;
    }
    if (line.includes('[[KEEP:') || line.includes('[[/KEEP')) {
      return refusal(input, 'E_COMPACTION_MALFORMED_MARKER', 'malformed KEEP marker', { line: index + 1 });
    }
  }

  if (inFence) return refusal(input, 'E_COMPACTION_UNCLOSED_BLOCK', 'unclosed fenced code block', { startLine: fenceStart + 1 });
  if (inKeep) return refusal(input, 'E_COMPACTION_UNCLOSED_BLOCK', 'unclosed KEEP block', { startLine: keepStart + 1 });

  // Type/contract/schema blocks and their brace bodies.
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (TYPE_START.test(line) || CONTRACT_START.test(line) || JSON_SCHEMA_KEY.test(line)) {
      add(index, balancedEnd(lines, index), 'typed-block');
    }
  }

  // Path, hash, check-result, and structural evidence lines.
  for (let index = 0; index < lines.length; index += 1) {
    if (isEvidenceLine(lines[index])) add(index, index, 'evidence');
  }

  const mandatoryResult = mandatoryRanges(input, lines, mandatory);
  if (!Array.isArray(mandatoryResult)) {
    return refusal(input, mandatoryResult.code, mandatoryResult.message, mandatoryResult.details);
  }
  for (const range of mandatoryResult) add(range.start, range.end, range.kind);

  const merged = mergeRanges(ranges);
  if (merged.length > MAX_PROTECTED_LINES) {
    return refusal(input, 'E_COMPACTION_INVALID_OPTIONS', 'too many protected ranges', { protected: merged.length });
  }
  const protectedLines = new Set<number>();
  for (const range of merged) {
    for (let index = range.start; index <= range.end; index += 1) protectedLines.add(index);
  }

  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    // A single trailing newline is structural formatting, not conversational
    // filler. Keep it byte-identical when the rest of the input is clean.
    const trailingNewlineSentinel = index === lines.length - 1 && lines[index] === '' && input.endsWith('\n');
    if (protectedLines.has(index) || trailingNewlineSentinel || !isEligibleConversational(lines[index])) kept.push(lines[index]);
  }
  const compacted = kept.join('\n');
  const removedChars = input.length - compacted.length;

  // All-or-nothing preservation proof: every protected range must survive
  // verbatim, and every mandatory snippet must remain present.
  for (const range of merged) {
    const text = lines.slice(range.start, range.end + 1).join('\n');
    if (!compacted.includes(text)) {
      return refusal(input, 'E_COMPACTION_PRESERVATION', 'a protected block would be lost', {
        kind: range.kind,
        startLine: range.start + 1,
        endLine: range.end + 1,
      });
    }
  }
  for (const snippet of mandatory) {
    if (!compacted.includes(snippet)) {
      return refusal(input, 'E_COMPACTION_MANDATORY_MISSING', 'a mandatory snippet would be lost', {
        snippet: snippet.slice(0, 80),
      });
    }
  }
  if (compacted.length > maxChars) {
    return refusal(input, 'E_COMPACTION_OUTPUT_TOO_LARGE', 'compacted output exceeds maxChars', {
      compactedChars: compacted.length,
      maxChars,
    });
  }

  return {
    compacted,
    removedChars: Math.max(0, removedChars),
    preservedBlocks: merged.length,
    pointer: removedChars > 0 ? `compact:${sha256Hex(input).slice(0, 16)}` : null,
    truncated: removedChars > 0,
  };
}

export const COMPACTION_LIMITS = {
  maxChars: DEFAULT_MAX_CHARS,
  maxInputChars: DEFAULT_MAX_INPUT_CHARS,
  maxMandatoryItems: MAX_MANDATORY_ITEMS,
} as const;
