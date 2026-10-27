import type { FetyStore, FetyTransactionType, TransactionFlow, TypeIconMap } from "../types/fety";

const FALLBACK_TYPE_ICONS: TypeIconMap = {
  deposit: "💵",
  expense: "🛒",
  transfer: "🏦",
};

export const LOCKED_TRANSACTION_TYPE_IDS = new Set(["deposit", "expense", "transfer"]);

export const STANDARD_TRANSACTION_TYPE_IDS = ["deposit", "expense", "transfer"] as const;

export function remapLegacyTransactionTypeId(typeId: string): string {
  if (typeId === "income") return "deposit";
  if (typeId === "bill") return "expense";
  if (typeId === "deposit" || typeId === "expense" || typeId === "transfer") return typeId;
  return "expense";
}

export function defaultTransactionTypes(icons: Partial<TypeIconMap> = FALLBACK_TYPE_ICONS): FetyTransactionType[] {
  const merged = { ...FALLBACK_TYPE_ICONS, ...icons };
  return [
    { id: "deposit", name: "Deposit", icon: merged.deposit ?? "💵", flow: "income", locked: true },
    { id: "expense", name: "Expense", icon: merged.expense ?? "🛒", flow: "expense", locked: true },
    { id: "transfer", name: "Transfer", icon: merged.transfer ?? "🏦", flow: "transfer", locked: true },
  ];
}

export function getTransactionTypes(store: FetyStore): FetyTransactionType[] {
  if (store.transactionTypes?.length) return store.transactionTypes;
  return defaultTransactionTypes(store.typeIcons);
}

export function flowForTransactionType(store: FetyStore, typeId: string): TransactionFlow {
  const normalized = remapLegacyTransactionTypeId(typeId);
  const tt = getTransactionTypes(store).find((t) => t.id === normalized);
  if (tt) return tt.flow;
  if (normalized === "deposit") return "income";
  if (normalized === "transfer") return "transfer";
  return "expense";
}

export function isTransferTransactionType(store: FetyStore, typeId: string): boolean {
  return flowForTransactionType(store, typeId) === "transfer";
}

export function iconForTransactionType(store: FetyStore, typeId: string): string {
  const normalized = remapLegacyTransactionTypeId(typeId);
  const tt = getTransactionTypes(store).find((t) => t.id === normalized);
  if (tt) return tt.icon;
  const legacy = store.typeIcons?.[normalized as keyof TypeIconMap];
  return legacy ?? "💬";
}

export function labelForTransactionType(store: FetyStore, typeId: string): string {
  const normalized = remapLegacyTransactionTypeId(typeId);
  const tt = getTransactionTypes(store).find((t) => t.id === normalized);
  return tt?.name ?? normalized;
}

export function signAmountForFlow(flow: TransactionFlow, raw: number): number {
  const n = Math.abs(raw);
  if (flow === "income") return n;
  return -n;
}

export function typeIconsFromTransactionTypes(types: FetyTransactionType[]): TypeIconMap {
  const icons = { ...FALLBACK_TYPE_ICONS };
  for (const t of types) {
    if (t.id in icons || t.id === "deposit" || t.id === "expense" || t.id === "transfer") {
      icons[t.id as keyof TypeIconMap] = t.icon;
    }
  }
  return icons;
}

export function standardizeTransactionTypesStore(store: FetyStore): FetyStore {
  const depositIcon = store.typeIcons?.deposit ?? store.typeIcons?.income ?? FALLBACK_TYPE_ICONS.deposit;
  const expenseIcon = store.typeIcons?.expense ?? store.typeIcons?.bill ?? FALLBACK_TYPE_ICONS.expense;
  const transferIcon = store.typeIcons?.transfer ?? FALLBACK_TYPE_ICONS.transfer;
  const types = defaultTransactionTypes({ deposit: depositIcon, expense: expenseIcon, transfer: transferIcon });

  return {
    ...store,
    transactions: store.transactions.map((t) => ({
      ...t,
      type: remapLegacyTransactionTypeId(t.type),
    })),
    recurringTransactions: (store.recurringTransactions ?? []).map((r) => ({
      ...r,
      transactionType: remapLegacyTransactionTypeId(r.transactionType),
    })),
    transactionTypes: types,
    typeIcons: typeIconsFromTransactionTypes(types),
    transactionTypesStandardV1: true,
  };
}
