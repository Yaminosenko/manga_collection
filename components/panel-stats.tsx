type StatPanneau = {
  valeur: string;
  libelle: string;
};

type PanelStatsProps = {
  stats: StatPanneau[];
  prix: string | null;
};

export function PanelStats({ stats, prix }: PanelStatsProps) {
  return (
    <div className="flex items-center justify-between gap-[12px] px-[18px] pb-[10px]">
      <div className="flex min-h-[40px] flex-col justify-center">
        {stats.map(({ valeur, libelle }) => (
          <span key={libelle} className="leading-[20px]">
            <span className="text-text text-[17px] font-medium">{valeur}</span>{" "}
            <span className="text-[12px] text-neutral-500">{libelle}</span>
          </span>
        ))}
      </div>

      {prix === null ? null : (
        <span className="text-accent text-[30px] leading-[40px] font-medium whitespace-nowrap">
          {prix}
        </span>
      )}
    </div>
  );
}
