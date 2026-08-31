import Link from "next/link";
import { Cover } from "@/components/cover";
import { formaterJour, formaterMoisLong } from "@/lib/format";
import type { SortiePlanning } from "@/lib/domain";

function sousTitre(sortie: SortiePlanning): string {
  const parties = sortie.editionsDeLaSerie > 1 ? [sortie.nom] : [];
  if (sortie.editeur) {
    parties.push(sortie.editeur);
  }
  return parties.join(" · ");
}

export function PlanningMonth({ sorties }: { sorties: SortiePlanning[] }) {
  return (
    <section className="flex flex-col gap-[4px]">
      <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
        {formaterMoisLong(sorties[0].date)}
      </h2>

      {sorties.map((sortie) => (
        <Link
          key={`${sortie.slug}-${sortie.numero}`}
          href={`/edition/${sortie.slug}`}
          className="border-row-divider flex items-center gap-[12px] border-b py-[9px] transition-colors hover:bg-text/2"
        >
          <span className="shadow-edge relative h-[120px] w-[84px] flex-none overflow-hidden rounded-cover">
            <Cover
              couvertureUrl={sortie.couvertureUrl}
              numero={sortie.numero}
              titre={sortie.titre}
              afficherNumero={false}
            />
            <span className="bg-scrim absolute bottom-0 left-0 m-[4px] rounded-[3px] px-[6px] py-[2px] text-[11px] font-medium text-neutral-500">
              {sortie.numero}
            </span>
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <span className="titre-serie text-text truncate text-[14.5px] font-medium">{sortie.titre}</span>
            {sousTitre(sortie) ? (
              <span className="truncate text-[12px] text-neutral-600">{sousTitre(sortie)}</span>
            ) : null}
            <span className="text-accent mt-[2px] text-[12.5px] font-medium">
              {formaterJour(sortie.date)}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}
