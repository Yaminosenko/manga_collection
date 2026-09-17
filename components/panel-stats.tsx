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
    <div className="flex items-center justify-between gap-[12px] pb-[10px]">
      <div className="flex h-[48px] flex-col justify-center">
        {stats.map(({ valeur, libelle }) => (
          <span key={libelle} className="block h-[24px] leading-[22px]">
            <span className="text-text text-[17px] leading-[22px] font-medium">{valeur}</span>{" "}
            <span className="text-[12px] leading-[22px] text-neutral-500">{libelle}</span>
          </span>
        ))}
      </div>

      {prix === null ? null : (
        <span className="text-accent text-[30px] leading-[48px] font-medium whitespace-nowrap">
          {prix}
        </span>
      )}
    </div>
  );
}
