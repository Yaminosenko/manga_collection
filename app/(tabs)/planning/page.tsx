import { PlanningMonth } from "@/components/planning-month";
import { chargerPlanning } from "@/lib/editions";
import { estProprietaire } from "@/lib/guard";
import { cleMois } from "@/lib/format";
import { LIBELLE_PLANNING_VIDE, TITRE_PLANNING } from "@/lib/constants";
import type { SortiePlanning } from "@/lib/domain";

export const dynamic = "force-dynamic";

function grouperParMois(sorties: SortiePlanning[]): SortiePlanning[][] {
  const mois = new Map<string, SortiePlanning[]>();
  for (const sortie of sorties) {
    const cle = cleMois(sortie.date);
    mois.set(cle, [...(mois.get(cle) ?? []), sortie]);
  }
  return [...mois.values()];
}

export default async function Page() {
  const sorties = await chargerPlanning();
  const mois = grouperParMois(sorties);
  const proprietaire = await estProprietaire();
  const instant = new Date().toISOString();

  return (
    <main className="flex flex-1 flex-col px-[18px] pt-[22px] pb-[18px]">
      <header className="flex items-baseline justify-between gap-[12px] pb-[16px]">
        <h1 className="text-text text-[22px] font-semibold">{TITRE_PLANNING}</h1>
        {sorties.length > 0 ? (
          <span className="text-[12px] text-neutral-500">
            {sorties.length} {sorties.length > 1 ? "sorties" : "sortie"}
          </span>
        ) : null}
      </header>

      {mois.length === 0 ? (
        <p className="text-[13px]/[1.6] text-neutral-500">{LIBELLE_PLANNING_VIDE}</p>
      ) : (
        <div className="flex flex-col gap-[22px]">
          {mois.map((groupe) => (
            <PlanningMonth
              key={cleMois(groupe[0].date)}
              sorties={groupe}
              proprietaire={proprietaire}
              instant={instant}
            />
          ))}
        </div>
      )}
    </main>
  );
}
