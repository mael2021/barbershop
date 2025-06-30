interface SummaryItemProps {
  label: string;
  value: string;
}

export const SummaryItem = ({ label, value }: SummaryItemProps) => {
  return (
    <div className="flex items-center gap-2">
      <h5 className="text-sm leading-tight font-bold tracking-wide text-pretty text-white uppercase">{label}:</h5>
      <p className="text-white">{value}</p>
    </div>
  );
};
