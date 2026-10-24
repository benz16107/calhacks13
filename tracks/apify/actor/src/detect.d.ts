export type Finding = { type: string; where: string; hidden: boolean; severity: number; why: string; evidence: string };
export type Analysis = { title: string; text: string; risk: 'none' | 'low' | 'medium' | 'high'; score: number; findings: Finding[]; removed: number };
export const PATTERNS: [string, RegExp, number, string][];
export function matches(text: string): { id: string; weight: number; what: string }[];
export function analyze(html: string): Analysis;
