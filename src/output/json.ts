import { summary } from '../engine/review.js';
import type { Finding } from '../engine/types.js';

export interface JsonReport {
  schemaVersion: 1;
  generatedAt: string;
  summary: { error: number; warn: number; info: number };
  findings: Finding[];
}

export function renderJson(findings: Finding[]): string {
  const report: JsonReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: summary(findings),
    findings,
  };
  return JSON.stringify(report, replacer, 2);
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return Object.fromEntries(value);
  if (value instanceof Set) return [...value];
  return value;
}
