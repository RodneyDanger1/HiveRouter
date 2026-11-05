import { z } from 'zod';

export const PROMPT_ANALYSIS_SOURCES = ['user', 'inferred', 'unknown'] as const;
export const PROMPT_ACCEPTANCE_STATUSES = ['stated', 'inferred', 'unproven'] as const;

export const PromptRequirementSchema = z
  .object({
    id: z.string().max(80).optional().default(''),
    text: z.string().min(1).max(600),
    source: z.enum(PROMPT_ANALYSIS_SOURCES),
    /** Exact substring copied from the user prompt; required for source=user. */
    evidenceQuote: z.string().max(600).nullable(),
  })
  .strict();

export const PromptAcceptanceCriterionSchema = z
  .object({
    id: z.string().max(80).optional().default(''),
    criterion: z.string().min(1).max(600),
    status: z.enum(PROMPT_ACCEPTANCE_STATUSES),
    /** How a human/checker could prove it; never a claim that it was checked. */
    proof: z.string().min(1).max(600),
    evidenceQuote: z.string().max(600).nullable(),
  })
  .strict();

export const PromptAmbiguitySchema = z
  .object({
    id: z.string().max(80).optional().default(''),
    question: z.string().min(1).max(600),
    whyItMatters: z.string().min(1).max(600),
  })
  .strict();

export const PromptAnalysisSchema = z
  .object({
    interpretedGoal: z.string().min(1).max(1200),
    summary: z.string().max(1200).optional().default(''),
    deliverables: z.array(z.string().min(1).max(400)).max(20).optional().default([]),
    requirements: z.array(PromptRequirementSchema).min(1).max(40).optional().default([]),
    acceptanceCriteria: z.array(PromptAcceptanceCriterionSchema).min(1).max(20).optional().default([]),
    ambiguities: z.array(PromptAmbiguitySchema).max(20).optional().default([]),
    nonGoals: z.array(z.string().min(1).max(400)).max(20).optional().default([]),
    restatedBrief: z.string().max(2400).optional().default(''),
    confidence: z.number().min(0).max(1),
    limitations: z
      .array(z.string().min(1).max(500))
      .min(1)
      .max(10)
      .optional()
      .default(['Intent is inferred from text; no repository inspection was performed.']),
  })
  .strict();

export type PromptAnalysis = z.infer<typeof PromptAnalysisSchema>;
export type PromptRequirement = z.infer<typeof PromptRequirementSchema>;
export type PromptAcceptanceCriterion = z.infer<typeof PromptAcceptanceCriterionSchema>;

/**
 * Models occasionally omit opaque ids. Assign deterministic local ids rather
 * than rejecting an otherwise usable analysis; never invent evidence fields.
 */
export function normalizePromptAnalysis(analysis: PromptAnalysis): PromptAnalysis {
  const requirements = analysis.requirements.map((item, index) => ({
    ...item,
    id: item.id.trim() || `r${index + 1}`,
  }));
  const acceptanceCriteria = analysis.acceptanceCriteria.map((item, index) => ({
    ...item,
    id: item.id.trim() || `a${index + 1}`,
  }));
  const ambiguities = analysis.ambiguities.map((item, index) => ({
    ...item,
    id: item.id.trim() || `q${index + 1}`,
  }));
  return {
    ...analysis,
    summary: analysis.summary.trim() || analysis.interpretedGoal,
    restatedBrief: analysis.restatedBrief.trim() || analysis.interpretedGoal,
    requirements,
    acceptanceCriteria,
    ambiguities,
    limitations:
      analysis.limitations.length > 0
        ? analysis.limitations
        : ['Intent is inferred from text; no repository inspection was performed.'],
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Semantic guard against invented "user said" claims. A user-sourced
 * requirement is only valid when its quote is an exact substring of the
 * prompt; inferred/unknown items must not masquerade as quotes.
 */
export function validatePromptAnalysis(analysis: PromptAnalysis, prompt: string): string[] {
  const errors: string[] = [];
  if (analysis.requirements.length === 0) errors.push('requirements must not be empty');
  if (analysis.acceptanceCriteria.length === 0) errors.push('acceptanceCriteria must not be empty');
  const normalizedPrompt = normalize(prompt);
  for (const requirement of analysis.requirements) {
    if (requirement.source === 'user') {
      if (!requirement.evidenceQuote || requirement.evidenceQuote.trim().length < 3) {
        errors.push(`requirement ${requirement.id}: source=user needs an exact evidenceQuote`);
        continue;
      }
      if (!normalizedPrompt.includes(normalize(requirement.evidenceQuote))) {
        errors.push(`requirement ${requirement.id}: evidenceQuote is not an exact prompt substring`);
      }
    } else if (requirement.evidenceQuote !== null) {
      errors.push(`requirement ${requirement.id}: source=${requirement.source} must have evidenceQuote=null`);
    }
  }
  for (const criterion of analysis.acceptanceCriteria) {
    if (criterion.status === 'stated') {
      if (!criterion.evidenceQuote || criterion.evidenceQuote.trim().length < 3) {
        errors.push(`acceptance ${criterion.id}: status=stated needs an exact evidenceQuote`);
        continue;
      }
      if (!normalizedPrompt.includes(normalize(criterion.evidenceQuote))) {
        errors.push(`acceptance ${criterion.id}: evidenceQuote is not an exact prompt substring`);
      }
    } else if (criterion.evidenceQuote !== null) {
      errors.push(`acceptance ${criterion.id}: status=${criterion.status} must have evidenceQuote=null`);
    }
  }
  if (analysis.limitations.length === 0) errors.push('limitations must not be empty');
  return errors;
}
