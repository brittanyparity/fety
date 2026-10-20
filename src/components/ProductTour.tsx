import { useEffect, useState } from "react";
import type { AnalysisTourStep } from "../types/analysis";

function phaseLabel(phase: AnalysisTourStep["phase"]): string {
  if (phase === "financial") return "Your finances";
  if (phase === "bridge") return "Next";
  if (phase === "product") return "How Fety works";
  return "Tour";
}

export default function ProductTour({
  steps,
  onStep,
  onDismiss,
  onFinishAction,
}: {
  steps: AnalysisTourStep[];
  onStep: (step: AnalysisTourStep) => void;
  onDismiss: () => void;
  onFinishAction?: (step: AnalysisTourStep) => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index >= steps.length - 1;

  useEffect(() => {
    if (step) onStep(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps]);

  if (!step) return null;

  return (
    <div className="fety-tour fety-tour--dock" role="dialog" aria-modal="true" aria-labelledby="fety-tour-title">
      <div className="fety-tour-card">
        <p className="fety-label">
          {phaseLabel(step.phase)} · {index + 1} of {steps.length}
        </p>
        <h2 id="fety-tour-title">{step.title}</h2>
        <p>{step.explanation}</p>
        <div className="fety-tour-actions">
          <button type="button" className="fety-talk-skip" onClick={onDismiss}>
            Skip tour
          </button>
          <div className="fety-tour-nav">
            {index > 0 ? (
              <button type="button" className="fety-splash-btn-ghost" onClick={() => setIndex((n) => n - 1)}>
                Back
              </button>
            ) : null}
            {!last ? (
              <button type="button" className="fety-splash-btn-primary" onClick={() => setIndex((n) => n + 1)}>
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="fety-splash-btn-primary"
                onClick={() => {
                  if (step.action) onFinishAction?.(step);
                  else onDismiss();
                }}
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
