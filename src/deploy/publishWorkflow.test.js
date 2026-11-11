import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const workflowPath = resolve(here, '../../.github/workflows/publish-container.yml');
const workflow = parse(readFileSync(workflowPath, 'utf8'));
const devStep = workflow.jobs.deploy.steps.find((step) => step.name === 'Deploy application to dev');

// Evaluates a condition made of `github.ref == '...'` terms joined by `||`.
function devStepRuns(condition, ref) {
  return condition.split('||').some((term) => {
    const match = /^github\.ref\s*==\s*'([^']+)'$/.exec(term.trim());
    if (!match) throw new Error(`unsupported condition term: ${term}`);
    return match[1] === ref;
  });
}

describe('publish-container workflow', () => {
  it('builds pushes to main and map-layout and to semver tags', () => {
    expect(workflow.on.push.branches).toContain('main');
    expect(workflow.on.push.branches).toContain('map-layout');
    expect(workflow.on.push.tags).toContain('*.*.*');
  });

  it('writes the dev condition as a bare expression, not a string containing ${{ }}', () => {
    expect(devStep.if).not.toContain('${{');
  });

  it('runs the dev deployment for main and map-layout pushes, not for tags', () => {
    expect(devStepRuns(devStep.if, 'refs/heads/main')).toBe(true);
    expect(devStepRuns(devStep.if, 'refs/heads/map-layout')).toBe(true);
    expect(devStepRuns(devStep.if, 'refs/tags/0.1.0')).toBe(false);
    expect(devStepRuns(devStep.if, 'refs/heads/feature-x')).toBe(false);
  });
});
