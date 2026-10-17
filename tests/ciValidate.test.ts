import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluate, renderSummary } from '../scripts/ci-validate.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const directories: string[] = [];

afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'ci-validate-'));
  directories.push(dir);
  return dir;
}

describe('evaluate', () => {
  it('passes when every job succeeded', () => {
    const evaluated = evaluate({
      build: { result: 'success' },
      static: { result: 'success' },
    });
    expect(evaluated.ok).toBe(true);
    expect(evaluated.failures).toEqual([]);
    expect(evaluated.rows).toEqual([
      { job: 'build', result: 'success' },
      { job: 'static', result: 'success' },
    ]);
  });

  it.each(['failure', 'cancelled', 'skipped'])('fails when a job result is %s', result => {
    const evaluated = evaluate({
      build: { result: 'success' },
      static: { result },
    });
    expect(evaluated.ok).toBe(false);
    expect(evaluated.failures).toEqual(['static']);
  });

  it('fails on an unknown result', () => {
    expect(evaluate({ build: { result: 'neutral' } }).ok).toBe(false);
    expect(evaluate({ build: {} }).rows).toEqual([{ job: 'build', result: 'unknown' }]);
    expect(evaluate({ build: {} }).ok).toBe(false);
  });

  it('passes when a skipped job is on the allowlist', () => {
    const needs = { build: { result: 'success' }, static: { result: 'skipped' } };
    expect(evaluate(needs, { allowedSkipped: ['static'] }).ok).toBe(true);
    expect(evaluate(needs).ok).toBe(false);
    expect(evaluate(
      { build: { result: 'failure' } },
      { allowedSkipped: ['build'] },
    ).ok).toBe(false);
  });

  it('fails when needs is empty', () => {
    expect(evaluate({}).ok).toBe(false);
    expect(evaluate({}).rows).toEqual([]);
    expect(evaluate({}).failures).toEqual([]);
  });
});

describe('renderSummary', () => {
  it('lists each job name, result, and duration, and writes n/a without timing', () => {
    const rows = [
      { job: 'build', result: 'success' },
      { job: 'static', result: 'success' },
      { job: 'test', result: 'failure' },
    ];
    const summary = renderSummary(rows, {
      jobs: [
        { name: 'build', started_at: '2026-10-17T00:00:00Z', completed_at: '2026-10-17T00:01:05Z' },
        { name: 'build-extra', started_at: '2026-10-17T00:00:00Z', completed_at: '2026-10-17T00:09:00Z' },
        { name: 'test (node)', started_at: '2026-10-17T00:00:00Z', completed_at: '2026-10-17T00:00:30Z' },
        { name: 'test (lint)', started_at: '2026-10-17T00:00:10Z', completed_at: '2026-10-17T00:02:00Z' },
        { name: 'static', started_at: '2026-10-17T00:00:00Z' },
      ],
    });
    expect(summary).toContain('| job | result | 耗時 |');
    expect(summary).toContain('| build | success | 1m 05s |');
    expect(summary).toContain('| static | success | n/a |');
    expect(summary).toContain('| test | failure | 1m 50s |');
    expect(renderSummary(rows, null)).toContain('| build | success | n/a |');
    expect(renderSummary(rows, { message: 'unavailable' })).toContain('| test | failure | n/a |');
  });
});

describe('cli', () => {
  function runCli(needs: unknown, summaryPath: string, extra: Record<string, string> = {}) {
    const home = join(tempDir(), 'home');
    mkdirSync(home);
    return spawnSync(process.execPath, ['scripts/ci-validate.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        HOME: home,
        NEEDS_JSON: JSON.stringify(needs),
        GITHUB_STEP_SUMMARY: summaryPath,
        JOBS_JSON_PATH: join(home, 'missing-jobs.json'),
        ...extra,
      },
    });
  }

  it('exits 1 and appends the summary when a job fails', () => {
    const dir = tempDir();
    const summaryPath = join(dir, 'step-summary.md');
    writeFileSync(summaryPath, 'kept\n');
    const result = runCli({ build: { result: 'failure' } }, summaryPath);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('build');
    const summary = readFileSync(summaryPath, 'utf8');
    expect(summary.startsWith('kept\n')).toBe(true);
    expect(summary).toContain('| build | failure | n/a |');
  });
});
