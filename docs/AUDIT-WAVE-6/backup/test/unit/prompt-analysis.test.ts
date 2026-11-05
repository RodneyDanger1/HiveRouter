import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PromptAnalysisSchema,
  validatePromptAnalysis,
  type PromptAnalysis,
} from '../../src/shared/prompt-analysis.js';

const valid: PromptAnalysis = {
  interpretedGoal: 'Create a blue chicken.',
  summary: 'A chicken that is blue.',
  deliverables: ['blue chicken'],
  requirements: [
    { id: 'r1', text: 'The object must be a chicken.', source: 'user', evidenceQuote: 'blue chicken' },
    { id: 'r2', text: 'The chicken must be blue.', source: 'user', evidenceQuote: 'blue chicken' },
  ],
  acceptanceCriteria: [
    { id: 'a1', criterion: 'The result is a chicken.', status: 'stated', proof: 'A human sees a chicken.', evidenceQuote: 'blue chicken' },
  ],
  ambiguities: [{ id: 'q1', question: 'What medium?', whyItMatters: 'A drawing and a 3D model are different deliverables.' }],
  nonGoals: [],
  restatedBrief: 'Create a blue chicken; prove both chicken and blue.',
  confidence: 0.8,
  limitations: ['Intent is inferred from text; no repository inspection was performed.'],
};

describe('prompt analysis contract', () => {
  it('accepts exact user quotes and leaves inferred evidence null', () => {
    expect(validatePromptAnalysis(valid, 'I want a blue chicken')).toEqual([]);
  });

  it('rejects an invented quote presented as user-stated', () => {
    const invented = {
      ...valid,
      requirements: [{ ...valid.requirements[0], evidenceQuote: 'purple chicken' }],
    };
    expect(validatePromptAnalysis(invented, 'I want a blue chicken')).toContain(
      'requirement r1: evidenceQuote is not an exact prompt substring',
    );
  });

  it('rejects evidence attached to an inferred claim', () => {
    const inferred = {
      ...valid,
      requirements: [{ ...valid.requirements[0], source: 'inferred' as const, evidenceQuote: 'blue chicken' }],
    };
    expect(validatePromptAnalysis(inferred, 'I want a blue chicken')).toContain(
      'requirement r1: source=inferred must have evidenceQuote=null',
    );
  });

  it('schema rejects empty limitations and validation rejects empty requirements', () => {
    expect(PromptAnalysisSchema.safeParse({ ...valid, limitations: [] }).success).toBe(false);
    expect(validatePromptAnalysis({ ...valid, requirements: [] }, 'I want a blue chicken')).toContain(
      'requirements must not be empty',
    );
  });
});

const { chatJson } = vi.hoisted(() => ({ chatJson: vi.fn() }));
vi.mock('../../src/server/llm/client.js', () => ({ chatJson }));

const { analyzePrompt } = await import('../../src/server/prompt/analyst.js');

describe('prompt analyst repair path', () => {
  beforeEach(() => chatJson.mockReset());

  it('repairs an invalid evidence quote once and returns the validated analysis', async () => {
    const invalid = {
      ...valid,
      requirements: [{ ...valid.requirements[0], evidenceQuote: 'purple chicken' }],
    };
    chatJson.mockResolvedValueOnce(invalid).mockResolvedValueOnce(valid);
    const result = await analyzePrompt('I want a blue chicken');
    expect(result.repairAttempted).toBe(true);
    expect(chatJson).toHaveBeenCalledTimes(2);
    expect(result.analysis).toEqual(valid);
  });

  it('refuses after one failed repair instead of returning invented evidence', async () => {
    const invalid = {
      ...valid,
      requirements: [{ ...valid.requirements[0], evidenceQuote: 'purple chicken' }],
    };
    chatJson.mockResolvedValue(invalid);
    await expect(analyzePrompt('I want a blue chicken')).rejects.toMatchObject({
      code: 'E_PROMPT_ANALYSIS_INVALID',
    });
    expect(chatJson).toHaveBeenCalledTimes(2);
  });
});
