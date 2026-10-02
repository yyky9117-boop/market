export type CaseMetrics = {
  caseId: string;
  safetyPass: boolean | null;
  safetyFalsePositive: boolean;
  actualShouldGenerate: boolean;
  shouldGenerateCorrect: boolean;
  actualFitLevel: 'strong' | 'medium' | 'weak';
  fitLevelCorrect: boolean;
  weakRejectCorrect: boolean | null;
  platformResults: Record<'weibo' | 'xiaohongshu' | 'douyin', { eligible: boolean; success: boolean }>;
  generatedCopyCount: number;
  internalDataLeakOutputs: number;
  internalDataLeak: boolean;
  hallucinationCandidates: string[];
  hallucinationCandidateOutputs: number;
  severeHallucinationConfirmed: boolean;
  error: string | null;
  latencyMs: number | null;
};

export function evaluateCase(record: Record<string, any>): CaseMetrics;
export function summarize(records: Array<Record<string, any>>, options?: { version?: string; datasetVersion?: string }): Record<string, any> & { releaseGate: { pass: boolean; unmet: string[] } };
