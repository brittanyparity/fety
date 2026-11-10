import TransactionDateRangeFilter from "./TransactionDateRangeFilter";

export default function HomeSectionDateRangePicker({
  rangeStartISO,
  rangeEndISO,
  onRangeChange,
  endingBalanceForDate,
  ariaLabel = "Choose dates",
}: {
  rangeStartISO: string;
  rangeEndISO: string;
  onRangeChange: (startISO: string, endISO: string) => void;
  endingBalanceForDate?: (dateISO: string) => number;
  ariaLabel?: string;
}) {
  return (
    <TransactionDateRangeFilter
      rangeStartISO={rangeStartISO}
      rangeEndISO={rangeEndISO}
      onRangeChange={onRangeChange}
      endingBalanceForDate={endingBalanceForDate}
      menuClassName="fety-home-section-date-picker"
      showClearAll={false}
      appearance="widget"
      fieldLabel="Dates"
    />
  );
}
