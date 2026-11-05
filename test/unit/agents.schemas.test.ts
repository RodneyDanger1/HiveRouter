import { describe, expect, it } from 'vitest';
import { config } from '../../src/server/config.js';
import {
  AgentPlanSchema,
  CandidateDraftSchema,
  FileEmissionSchema,
  ProjectPlanSchema,
  ReviewSchema,
  TestsSchema,
} from '../../src/server/agents/registry.js';
import {
  invalidCandidateDraft,
  invalidFileEmission,
  invalidProjectPlan,
  invalidReview,
  invalidRouterPlan,
  invalidTests,
  validCandidateDraft,
  validCartographerPlan,
  validEpicPlan,
  validFileEmission,
  validProjectPlan,
  validReview,
  validRouterPlan,
  validTests,
} from '../fixtures/agents/fixtures.js';

describe('agent output schemas', () => {
  it('accepts a complete architect plan and rejects a fileless plan', () => {
    expect(ProjectPlanSchema.safeParse(validProjectPlan).success).toBe(true);
    expect(ProjectPlanSchema.safeParse(invalidProjectPlan).success).toBe(false);
  });

  it('accepts every AgentPlan variant and rejects a malformed router plan', () => {
    expect(AgentPlanSchema.safeParse(validProjectPlan).success).toBe(true);
    expect(AgentPlanSchema.safeParse(validRouterPlan).success).toBe(true);
    expect(AgentPlanSchema.safeParse(validEpicPlan).success).toBe(true);
    expect(AgentPlanSchema.safeParse(validCartographerPlan).success).toBe(true);
    expect(AgentPlanSchema.safeParse(invalidRouterPlan).success).toBe(false);
  });

  it('accepts a full file emission and rejects empty content', () => {
    expect(FileEmissionSchema.safeParse(validFileEmission).success).toBe(true);
    expect(FileEmissionSchema.safeParse(invalidFileEmission).success).toBe(false);
  });

  it('bounds generated file content by UTF-8 bytes with a typed refusal', () => {
    const limit = config.limits.maxFileBytes;
    const exact = FileEmissionSchema.safeParse({ ...validFileEmission, content: 'a'.repeat(limit) });
    expect(exact.success).toBe(true);

    const oversized = FileEmissionSchema.safeParse({ ...validFileEmission, content: 'a'.repeat(limit + 1) });
    expect(oversized.success).toBe(false);
    expect(oversized.success ? '' : oversized.error.issues[0]?.message).toMatch(/^E_FILE_TOO_LARGE:/);

    const unicodeOversized = FileEmissionSchema.safeParse({
      ...validFileEmission,
      content: 'é'.repeat(Math.floor(limit / 2) + 1),
    });
    expect(unicodeOversized.success).toBe(false);
  });

  it('bounds generated test and review file content at the same byte limit', () => {
    const limit = config.limits.maxFileBytes;
    const tests = TestsSchema.safeParse({
      summary: 'test',
      testCommand: 'npm test',
      files: [{ path: 'tests/a.test.ts', language: 'typescript', content: 'a'.repeat(limit + 1) }],
    });
    expect(tests.success).toBe(false);
    expect(tests.success ? '' : tests.error.issues[0]?.message).toMatch(/^E_FILE_TOO_LARGE:/);

    const review = ReviewSchema.safeParse({
      verdict: 'changes_required',
      summary: 'revision',
      findings: [],
      files: [{ path: 'src/a.ts', content: 'a'.repeat(limit + 1) }],
    });
    expect(review.success).toBe(false);
    expect(review.success ? '' : review.error.issues[0]?.message).toMatch(/^E_FILE_TOO_LARGE:/);
  });

  it('accepts a review with a valid severity and rejects an unknown severity', () => {
    expect(ReviewSchema.safeParse(validReview).success).toBe(true);
    expect(ReviewSchema.safeParse(invalidReview).success).toBe(false);
  });

  it('defaults reviewedFiles to empty and accepts declared coverage', () => {
    const omitted = ReviewSchema.safeParse(validReview);
    expect(omitted.success).toBe(true);
    expect(omitted.success ? omitted.data.reviewedFiles : null).toEqual([]);

    const declared = ReviewSchema.safeParse({ ...validReview, reviewedFiles: ['src/main.py'] });
    expect(declared.success).toBe(true);
    expect(declared.success ? declared.data.reviewedFiles : null).toEqual(['src/main.py']);
  });

  it('accepts runnable tests and rejects empty test files', () => {
    expect(TestsSchema.safeParse(validTests).success).toBe(true);
    expect(TestsSchema.safeParse(invalidTests).success).toBe(false);
  });

  it('accepts a candidate draft and rejects a route-policy candidate type', () => {
    expect(CandidateDraftSchema.safeParse(validCandidateDraft).success).toBe(true);
    expect(CandidateDraftSchema.safeParse(invalidCandidateDraft).success).toBe(false);
  });
});
