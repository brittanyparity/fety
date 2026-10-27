/** Calendar day of month with English ordinal suffix (1st, 2nd, 15th, …). */
export function formatOrdinalDay(day: number): string {
  const n = Math.min(31, Math.max(1, Math.round(day)));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
