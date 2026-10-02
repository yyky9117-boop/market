import type { Metadata } from "next";
import EvaluationWorkspace from "./EvaluationWorkspace";

export const metadata: Metadata = {
  title: "Badcase 人工评测工作台",
  description: "在本地复核机器评测 Badcase 并保存人工结论。",
};

export default function EvaluationPage() {
  return <EvaluationWorkspace />;
}
