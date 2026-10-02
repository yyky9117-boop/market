import fs from 'node:fs/promises';
import path from 'node:path';
import { summarize, evaluateCase } from './machineMetrics.mjs';
import { buildBadcasesCsv, buildBacklogCsv } from './resultArtifacts.mjs';

const resultsDir = path.resolve('evaluation/results');
const rawPath = path.join(resultsDir, 'raw_results_v1.json');
const raw = JSON.parse(await fs.readFile(rawPath, 'utf8'));
for (const record of raw.cases) record.machineMetrics = evaluateCase(record);
const summary = summarize(raw.cases, { version: raw.version, datasetVersion: raw.datasetVersion });
raw.summaryRefreshedAt = new Date().toISOString();
await fs.writeFile(rawPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
await fs.writeFile(path.join(resultsDir, 'summary_v1.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await fs.writeFile(path.join(resultsDir, `evaluation_results_${raw.version}.json`), `${JSON.stringify({ ...raw, summary }, null, 2)}\n`, 'utf8');
await fs.writeFile(path.join(resultsDir, 'badcases.csv'), buildBadcasesCsv(raw.cases, raw.version), 'utf8');
await fs.writeFile(path.resolve('evaluation/backlog/evaluation_backlog.csv'), buildBacklogCsv(raw.cases), 'utf8');
console.log(`Refreshed ${raw.cases.length} case records; gate=${summary.releaseGate.pass ? 'PASS' : 'FAIL / INCOMPLETE'}`);
