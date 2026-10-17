import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A job passes only on success, or on skipped when its id is allowlisted.
// Anything else, including an empty needs map, fails the gate.
export function evaluate(needs, { allowedSkipped = [] } = {}) {
  const allow = new Set(allowedSkipped);
  if (needs === null || typeof needs !== 'object' || Array.isArray(needs)) {
    return { ok: false, rows: [], failures: [] };
  }

  const rows = [];
  const failures = [];
  for (const [job, value] of Object.entries(needs)) {
    const result = readResult(value);
    rows.push({ job, result });
    const allowedSkip = result === 'skipped' && allow.has(job);
    if (result !== 'success' && !allowedSkip) failures.push(job);
  }
  return { ok: rows.length > 0 && failures.length === 0, rows, failures };
}

// Durations come from the Actions jobs API. Matrix legs are named "key (…)"
// and contribute the longest leg; a key with no timed match is n/a.
export function renderSummary(rows, jobsApi) {
  const jobs = jobEntries(jobsApi);
  const lines = ['| job | result | 耗時 |', '| --- | --- | --- |'];
  for (const row of rows) {
    lines.push(`| ${cell(row.job)} | ${cell(row.result)} | ${durationFor(row.job, jobs)} |`);
  }
  return `${lines.join('\n')}\n`;
}

function readResult(value) {
  if (!value || typeof value !== 'object' || typeof value.result !== 'string' || value.result.length === 0) {
    return 'unknown';
  }
  return value.result;
}

function jobEntries(jobsApi) {
  if (Array.isArray(jobsApi)) return jobsApi;
  if (jobsApi && typeof jobsApi === 'object' && Array.isArray(jobsApi.jobs)) return jobsApi.jobs;
  return [];
}

function durationFor(key, jobs) {
  let longest = null;
  for (const job of jobs) {
    const name = job && typeof job.name === 'string' ? job.name : '';
    if (name !== key && !name.startsWith(`${key} (`)) continue;
    const start = Date.parse(job.started_at ?? '');
    const end = Date.parse(job.completed_at ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const elapsed = end - start;
    if (longest === null || elapsed > longest) longest = elapsed;
  }
  return longest === null ? 'n/a' : formatDuration(longest);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function cell(value) {
  return String(value).replace(/\|/g, '/').replace(/\r?\n/g, ' ');
}

function loadJobs(path) {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function allowedFromEnv(value) {
  return (value ?? '').split(',').map(item => item.trim()).filter(item => item.length > 0);
}

function writeSummary(rows) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  appendFileSync(summaryPath, renderSummary(rows, loadJobs(process.env.JOBS_JSON_PATH)));
}

function main() {
  const raw = process.env.NEEDS_JSON;
  let needs = null;
  let parsed = false;
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      needs = JSON.parse(raw);
      parsed = needs !== null && typeof needs === 'object' && !Array.isArray(needs);
    } catch {
      parsed = false;
    }
  }

  if (!parsed) {
    writeSummary([]);
    console.error('validate failed: NEEDS_JSON is missing or invalid');
    process.exit(1);
  }

  const evaluated = evaluate(needs, { allowedSkipped: allowedFromEnv(process.env.ALLOWED_SKIPPED) });
  writeSummary(evaluated.rows);
  if (evaluated.ok) return;
  if (evaluated.failures.length === 0) console.error('validate failed: needs is empty');
  else console.error(`validate failed:\n${evaluated.failures.join('\n')}`);
  process.exit(1);
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) main();
