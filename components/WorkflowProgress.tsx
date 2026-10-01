import { WORKFLOW_STEPS } from "@/lib/types";

interface WorkflowProgressProps {
  activeStep: number;
  visible: boolean;
}

export default function WorkflowProgress({ activeStep, visible }: WorkflowProgressProps) {
  return (
    <section className="workflow" aria-live="polite" aria-label="AI 工作流进度">
      <div className="workflow-heading">
        <strong>{visible ? "AI 正在逐步分析热点" : "一条清晰的 AI 工作流"}</strong>
        <span>{!visible ? "从热点到内容，环环相扣" : activeStep >= WORKFLOW_STEPS.length ? "分析完成 · 已生成结果" : `${Math.min(activeStep + 1, WORKFLOW_STEPS.length)} / ${WORKFLOW_STEPS.length} 正在处理`}</span>
      </div>
      <div className="workflow-steps">
        {WORKFLOW_STEPS.map((step, index) => {
          const state = !visible ? "idle" : index < activeStep ? "done" : index === activeStep ? "active" : "idle";
          return (
            <div className={`workflow-step ${state}`} key={step}>
              <span className="step-icon">{state === "done" ? "✓" : state === "active" ? <span className="spinner" style={{ borderColor: "#dce9dc", borderTopColor: "#386b4c" }} /> : String(index + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
