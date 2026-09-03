import Link from "next/link";
import { Cover } from "@/components/cover";
import { PlanningClaim } from "@/components/planning-claim";
import { formaterJour, formaterMoisLong } from "@/lib/format";
import { sortieEstParue } from "@/lib/domain";
import type { SortiePlanning } from "@/lib/domain";

function sousTitre(sortie: SortiePlanning): string {
  const parties = sortie.editionsDeLaSerie > 1 ? [sortie.nom] : [];
  if (sortie.editeur) {
    parties.push(sortie.editeur);
  }
  return parties.join(" · ");
}

export function PlanningMonth({
  sorties,
  proprietaire,
  instant,
}: {
  sorties: SortiePlanning[];
  proprietaire: boolean;
  instant: string;
}) {
  const maintenant = new Date(instant);

  return (
    <section className="flex flex-col gap-[4px]">
      <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
        {formaterMoisLong(sorties[0].date)}
      </h2>

      {sorties.map((sortie) => (
        <div
          key={`${sortie.slug}-${sortie.numero}`}
          className="border-row-divider flex items-center gap-[12px] border-b py-[9px]"
        >
        <Link
          href={`/edition/${sortie.slug}`}
          className="flex min-w-0 flex-1 items-center gap-[12px] transition-colors hover:bg-text/2"
        >
          <span className="shadow-edge h-[120px] w-[84px] flex-none overflow-hidden rounded-cover">
            <Cover
              couvertureUrl={sortie.couvertureUrl}
              numero={sortie.numero}
              titre={sortie.titre}
              afficherNumero={false}
            />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <span className="flex items-center gap-[7px]">
              <span className="titre-serie text-text truncate text-[14.5px] font-medium">
                {sortie.titre}
              </span>
              <span className="bg-accent-800 text-accent-200 flex-none rounded-[3px] px-[7px] py-[2px] text-[11px] font-medium">
                Tome {sortie.numero}
              </span>
            </span>
            <span className="flex min-w-0 items-baseline gap-[7px]">
              <span className="text-accent flex-none text-[13.5px] font-medium">
                {formaterJour(sortie.date)}
              </span>
              {sousTitre(sortie) ? (
                <span className="truncate text-[12px] text-neutral-600">
                  · {sousTitre(sortie)}
                </span>
              ) : null}
            </span>
          </span>
        </Link>

          {proprietaire && sortieEstParue(sortie.date, maintenant) ? (
            <PlanningClaim slug={sortie.slug} numero={sortie.numero} />
          ) : null}
        </div>
      ))}
    </section>
  );
}
