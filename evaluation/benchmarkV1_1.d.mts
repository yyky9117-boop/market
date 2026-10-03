export declare const PRIMARY: string[];
export declare const SECONDARY: Record<string,string[]>;
export declare const ratingFields: string[];
export interface Expected { marketingSafe:boolean; sensitiveTopic:boolean; shouldGenerate:boolean; fitLevel:"strong"|"medium"|"weak"; expectedConsumerNeed:string[];expectedRelationshipPath:string[];forbiddenAngles:string[]; }
export interface AdjudicationInput { expected?:Partial<Expected>;labelConfirmed?:boolean;acceptableProductSkus?:string[];productReason?:string;reason?:string;source?:string;evidence?:string;reviewedAt?:string;rootCause?:{primary:string;secondary:string;reason:string};history?:Array<{at:string;changes:Record<string,unknown>}>; }
export interface Fixture {id:string;datasetVersion:string;category:string;news:{title:string;brief:string};product:{sku:string;name:string;detail:string};expected:Expected;}
export interface RawRecord {case:Fixture;expected:Expected;actual:{analysis:{marketingSafe:boolean;sensitiveTopic:boolean;reason:string};product:{sku:string;name:string}|null;opportunityEvaluation:{shouldGenerate:boolean;fitLevel:string;relationshipPath:string[]}|null;contentStrategy:unknown;platformContents:Record<string,unknown>;platformStatuses:Record<string,string>;error?:string;failureType?:string};error?:string|null;judgeResult?:{scores:Record<string,number>;summary:string;confirmedHallucination:boolean;internalDataLeak:boolean};}
export interface RawRun {version:string;runId:string;cases:RawRecord[];}
export interface BenchmarkCase extends Fixture {originalExpected:Expected;adjudicatedExpected:Expected;adjudication:{status:string;changed:boolean;changedFields:string[];source:string|null;reason:string|null;reviewedAt:string|null;evidence:string|null};originalProductSku:string;acceptableProductSkus:string[]|null;productAdjudication:{status:string;reason:string|null;source:string|null};machineDetection:{flagged:boolean;type:string;priority:string;reason:string};humanVerdict:{isBadcase:boolean|null;status:string;wouldUse:string|null;wouldUseApplicable:boolean;mode:string;reviewedAt:string|null};rootCause:{originalPrimary:string|null;originalSecondary:string|null;primary:string|null;secondary:string|null;status:string;reason:string|null;suggestion:{primary:string;secondary:string;reason:string}|null};executionStatus:"success"|"partial"|"error";decisionStatus:"generate"|"reject"|"unknown";reason:string|null;}
export type Flags=Record<string,{type:string;priority:string;reason:string}>;
export type Reviews=Record<string,Record<string,string|number|null|undefined>>;
export interface Rate {numerator:number;denominator:number;value:number|null;}
export interface BenchmarkSummary {
 datasetVersion:string;businessVersion:string;runId:string;status:string;totalCases:number;
 decisionQuality:{completedDecisionAccuracy:Rate;endToEndCorrectRate:Rate;originalGoldenCompletedAccuracy:Rate;originalGoldenEndToEndCorrectRate:Rate;byCategory:Record<string,{completedAccuracy:Rate;endToEndCorrectRate:Rate}>;falseAcceptCaseIds:string[];falseRejectCaseIds:string[];fitLevelAccuracy:Rate;fitLevelCoverage:Rate;goldenPendingCaseIds:string[]};
 safety:{recall:Rate;falsePositiveRate:Rate;sensitiveTopicAccuracy:Rate;sensitiveDetectionAccuracy:Rate;unsafeFalseAcceptCaseIds:string[];pendingSafetyCaseIds:string[]};
 contentQuality:{judgeConfirmedHallucinationRate:Rate;judgeHallucinationCaseIds:string[];humanConfirmedHallucination:{count:number;caseIds:string[];rate:null;status:string};internalDataLeakOutputRate:Rate;internalDataLeakJudgeCaseIds:string[];platformJudgeAverages:Record<string,{sampleSize:number;value:number|null}>;wouldUseApplicableReviewed:number;humanUsableRate:Rate;humanDirectUseRate:Rate};
 reliability:{pipelineCompletionRate:Rate;executionErrorRate:Rate;executionErrorCaseIds:string[];timeoutCount:number;invalidJsonCount:number;analysisErrorCount:number;unclassifiedOrResponseErrorCount:number;platformPartialFailureCount:number;failedKnownDecisionOpportunityLoss:number};
 productMatching:{legacyExactSkuHitRate:Rate;exactSkuHitRate:Rate;acceptableSkuHitRate:Rate;acceptableLabelCoverage:Rate;semanticRelevance:{sampleSize:number;value:number|null;source:string};candidateCaseIds:string[]};
 detector:{status:string;reviewed:number;total:number;tp:number;fp:number;fn:number|null;tn:number|null;observedFn:number;observedTn:number;precision:Rate;recall:Rate|null;f1:Rate|null;falsePositiveRate:Rate|null;falseNegativeRate:Rate|null};
 humanEvaluation:{completed:number;remaining:number;disputed:number;confirmedCaseIds:string[];notBadcaseCount:number;rootCauseDistribution:Record<string,number>;pendingRootCaseIds:string[];missingSeverityCaseIds:string[]};
 goldenCalibration:{changedCaseIds:string[];pendingCaseIds:string[]};
 freeze:{ready:boolean;remainingHumanVerdicts:number;pendingGolden:number;pendingRootCauses:number;missingSeverity:number};
}
export function execution(record:RawRecord):Pick<BenchmarkCase,"executionStatus"|"decisionStatus"|"reason">;
export function rootSuggestion(record:RawRecord,review:Record<string,unknown>):BenchmarkCase["rootCause"]["suggestion"];
export function buildBenchmark(dataset:Fixture[],raw:RawRun,flags:Flags,reviews:Reviews,adjudications?:Record<string,AdjudicationInput>):BenchmarkCase[];
export function summarizeBenchmark(cases:BenchmarkCase[],raw:RawRun,reviews:Reviews):BenchmarkSummary;
export function clusteredBacklog(cases:BenchmarkCase[],reviews:Reviews,summary:BenchmarkSummary):Array<Record<string,string|number|null>>;
