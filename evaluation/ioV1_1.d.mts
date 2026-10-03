import type {Fixture,RawRun,Flags,Reviews,AdjudicationInput,BenchmarkCase,BenchmarkSummary} from "./benchmarkV1_1.mjs";
export declare const humanFields:string[];export declare const machineFields:string[];export declare const headers:string[];
export function sha(b:Buffer):string;
export function readJson<T>(file:string,fallback?:T):Promise<T>;
export function atomicJson(file:string,value:unknown):Promise<void>;
export function withFileLock<T>(root:string,operation:()=>Promise<T>):Promise<T>;
export function refreshWorkbookCopies(state:Calibration):Promise<void>;
export function loadCompatibleWorkbook(bytes:Buffer):Promise<import("exceljs").Workbook>;
export interface ImportSnapshot {source:string;sha256:string;reviews:Reviews;flags:Flags;displayRows:Record<string,Record<string,string>>;}
export interface Calibration {root:string;dataset:Fixture[];raw:RawRun;imported:ImportSnapshot;reviews:Reviews;adjudications:Record<string,AdjudicationInput>;cases:BenchmarkCase[];summary:BenchmarkSummary;backlog:Array<Record<string,string|number|null>>;}
export function importHuman(root:string):Promise<ImportSnapshot>;
export function loadCalibration(root?:string):Promise<Calibration>;
export function displayCase(c:BenchmarkCase,record:RawRun["cases"][number],imported:ImportSnapshot):Record<string,string>;
export function buildReviewRows(state:Calibration):Array<Array<string|number|null>>;
