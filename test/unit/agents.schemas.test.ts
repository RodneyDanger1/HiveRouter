import { describe, expect, it } from 'vitest';
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

  it('accepts a review with a valid severity and rejects an unknown severity', () => {
    expect(ReviewSchema.safeParse(validReview).success).toBe(true);
    expect(ReviewSchema.safeParse(invalidReview).success).toBe(false);
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
