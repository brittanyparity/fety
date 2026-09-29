import { useEffect, useState } from "react";

export type TourPage = "dashboard" | "calendar" | "spending" | "budget" | "goals";

const STEPS: { title: string; body: string; page: TourPage }[] = [
  {
    title: "Spending power",
    body: "This is the amount Fety estimates you can safely spend based on your current cash flow.",
    page: "dashboard",
  },
  {
    title: "Calendar",
    body: "This shows when your money comes in and when expenses happen.",
    page: "calendar",
  },
  {
    title: "Spending",
    body: "Here you can see where your money is going.",
    page: "spending",
  },
  {
    title: "Budget",
    body: "Use this to set spending targets and compare them with actual spending.",
    page: "budget",
  },
  {
    title: "Goals",
    body: "This is where you can connect your money to the things you're working toward.",
    page: "goals",
  },
  {
    title: "Transactions",
    body: "Spending also holds the detailed record behind your financial picture.",
    page: "spending",
  },
];

export default function ProductTour({
  onGo,
  onDismiss,
}: {
  onGo: (page: TourPage) => void;
  onDismiss: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  useEffect(() => {
    onGo(STEPS[0].page);
    // Start on the first tour surface once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fety-tour" role="dialog" aria-modal="true" aria-labelledby="fety-tour-title">
      <button type="button" className="fety-tour-backdrop" aria-label="Close tour" onClick={onDismiss} />
      <div className="fety-tour-card">
        <p className="fety-label">
          {index + 1} of {STEPS.length}
        </p>
        <h2 id="fety-tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="fety-tour-actions">
          <button type="button" className="fety-talk-skip" onClick={onDismiss}>
            Skip tour
          </button>
          {!last ? (
            <button
              type="button"
              className="fety-splash-btn-primary"
              onClick={() => {
                const next = STEPS[index + 1];
                setIndex((n) => n + 1);
                if (next) onGo(next.page);
              }}
            >
              Next
            </button>
          ) : (
            <button type="button" className="fety-splash-btn-primary" onClick={onDismiss}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}