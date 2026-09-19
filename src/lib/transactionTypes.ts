import type { FetyStore, FetyTransactionType, TransactionFlow, TypeIconMap } from "../types/fety";

const FALLBACK_TYPE_ICONS: TypeIconMap = {
  income: "💵",
  expense: "🛒",
  bill: "📋",
  transfer: "🏦",
};

export const LOCKED_TRANSACTION_TYPE_IDS = new Set(["income", "expense", "bill", "transfer"]);

export function defaultTransactionTypes(icons: TypeIconMap = FALLBACK_TYPE_ICONS): FetyTransactionType[] {
  return [
    { id: "income", name: "Income", icon: icons.income, flow: "income", locked: true },
    { id: "expense", name: "Expense", icon: icons.expense, flow: "expense", locked: true },
    { id: "bill", name: "Bill", icon: icons.bill, flow: "bill", locked: true },
    { id: "transfer", name: "Transfer", icon: icons.transfer, flow: "transfer", locked: true },
  ];
}

export function getTransactionTypes(store: FetyStore): FetyTransactionType[] {
  if (store.transactionTypes?.length) return store.transactionTypes;
  return defaultTransactionTypes(store.typeIcons);
}

export function flowForTransactionType(store: FetyStore, typeId: string): TransactionFlow {
  const tt = getTransactionTypes(store).find((t) => t.id === typeId);
  if (tt) return tt.flow;
  if (typeId === "income") return "income";
  if (typeId === "transfer") return "transfer";
  if (typeId === "bill") return "bill";
  return "expense";
}

export function iconForTransactionType(store: FetyStore, typeId: string): string {
  const tt = getTransactionTypes(store).find((t) => t.id === typeId);
  if (tt) return tt.icon;
  const legacy = store.typeIcons?.[typeId as keyof TypeIconMap];
  return legacy ?? "💬";
}

export function labelForTransactionType(store: FetyStore, typeId: string): string {
  const tt = getTransactionTypes(store).find((t) => t.id === typeId);
  return tt?.name ?? typeId;
}

export function signAmountForFlow(flow: TransactionFlow, raw: number): number {
  const n = Math.abs(raw);
  if (flow === "income") return n;
  return -n;
}

export function typeIconsFromTransactionTypes(types: FetyTransactionType[]): TypeIconMap {
  const icons = { ...FALLBACK_TYPE_ICONS };
  for (const t of types) {
    if (t.id in icons) {
      icons[t.id as keyof TypeIconMap] = t.icon;
    }
  }
  return icons;
}
