import { flowForTransactionType } from "../lib/transactionTypes";
import type { FetyStore } from "../types/fety";

export default function TransactionGlyphIcon({
  typeId,
  store,
  size = 18,
  className,
}: {
  typeId: string;
  store: FetyStore;
  size?: number;
  className?: string;
}) {
  const flow = flowForTransactionType(store, typeId);
  const cn = className ? `fety-txn-glyph-icon ${className}` : "fety-txn-glyph-icon";

  if (flow === "transfer") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn} aria-hidden>
        <path
          d="M7.5 8.25h9m-9 3H12m0 0 3-3m-3 3 3 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (flow === "income") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn} aria-hidden>
        <path d="M12 4.5v15m0-15 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn} aria-hidden>
      <path d="M12 19.5v-15m0 15-4-4m4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
