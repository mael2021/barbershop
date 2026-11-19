interface SummaryItemProps {
  label: string;
  value: string;
}

export const SummaryItem = ({ label, value }: SummaryItemProps) => {
  return (
    <div className="flex items-center gap-2">
      <h5 className="text-xs leading-tight font-bold tracking-wide text-pretty text-white uppercase booking-roomy:text-[0.8125rem] sm:text-sm">{label}:</h5>
      <p className="text-xs text-white booking-roomy:text-[0.8125rem] booking-roomy:leading-[1.125rem] sm:text-base">{value}</p>
    </div>
  );
};
