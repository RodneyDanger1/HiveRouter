import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AgentPlanSchema,
  PLAN_AGENT_IDS,
  ProjectPlanSchema,
  getAgent,
  planOutputSchemaFor,
} from '../../src/server/agents/registry.js';
import {
  invalidRouterPlan,
  validCartographerPlan,
  validEpicPlan,
  validProjectPlan,
  validRouterPlan,
} from '../fixtures/agents/fixtures.js';

const DOCUMENTED_PLAN_PAYLOADS: Record<(typeof PLAN_AGENT_IDS)[number], unknown> = {
  architect: validProjectPlan,
  router: validRouterPlan,
  epic: validEpicPlan,
  cartographer: validCartographerPlan,
};

describe('AF-09 advertised plan contract', () => {
  it('names the four plan agents and accepts each documented payload through the selector', () => {
    expect([...PLAN_AGENT_IDS]).toEqual(['architect', 'router', 'epic', 'cartographer']);
    for (const agentId of PLAN_AGENT_IDS) {
      expect(getAgent(agentId)?.outputKind).toBe('plan');
      expect(planOutputSchemaFor(agentId).safeParse(DOCUMENTED_PLAN_PAYLOADS[agentId]).success).toBe(true);
    }
  });

  it('rejects a router payload that is missing summary', () => {
    expect(planOutputSchemaFor('router').safeParse(invalidRouterPlan).success).toBe(false);
  });

  it('accepts a ProjectPlan through the router selector (union fallback)', () => {
    expect(planOutputSchemaFor('router').safeParse(validProjectPlan).success).toBe(true);
  });

  it('keeps ProjectPlanSchema strict for the full-build planning path', () => {
    expect(ProjectPlanSchema.safeParse(validRouterPlan).success).toBe(false);
    expect(AgentPlanSchema.safeParse(validRouterPlan).success).toBe(true);
  });

  it('wires the adhoc plan branch to the selector and keeps the full-build architect on ProjectPlanSchema', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/server/pipeline/run.ts'), 'utf8');
    expect(source).toMatch(/agent\.outputKind === 'plan'[\s\S]{0,400}?planOutputSchemaFor\(agent\.id\)/);
    expect(source).toMatch(/agentStep\(runId, 'planning', 'architect'[\s\S]{0,400}?ProjectPlanSchema/);
  });

  it('publishes the exact AgentsPage validation hint', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'web/src/pages/AgentsPage.tsx'), 'utf8');
    expect(source).toContain('Structured JSON outputs are schema-validated before they are stored; text output is stored as text.');
    expect(source).not.toContain('Output is schema-validated before it is stored.');
  });
});
