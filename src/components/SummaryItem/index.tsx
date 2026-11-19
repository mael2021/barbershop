interface SummaryItemProps {
  label: string;
  value: string;
}

export const SummaryItem = ({ label, value }: SummaryItemProps) => {
  return (
    <div className="flex items-center gap-2">
      <h5 className="text-xs leading-tight font-bold tracking-wide text-pretty text-white uppercase sm:text-sm">{label}:</h5>
      <p className="text-xs text-white sm:text-base">{value}</p>
    </div>
  );
};
