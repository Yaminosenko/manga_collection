import Link from "next/link";
import { Cover } from "@/components/cover";
import { PauseCircle, WarningCircle } from "@/components/icons";
import type { EditionManquante } from "@/lib/domain";

const PLACEHOLDER_MANQUANTS = "p-[3px] text-[9px] text-neutral-700";

function IconeEtat({ edition }: { edition: EditionManquante }) {
  const className = "size-[13px] flex-none text-neutral-600";

  if (edition.aVerifier) {
    return <WarningCircle className={className} />;
  }
  if (edition.statut === "ABANDONNEE" || edition.statut === "EN_PAUSE") {
    return <PauseCircle className={className} />;
  }
  return null;
}

export function MissingGroup({ edition }: { edition: EditionManquante }) {
  const sousTitre = edition.editeur ? `${edition.nom} · ${edition.editeur}` : edition.nom;

  return (
    <li className="border-row-divider border-b py-[13px]">
      <Link
        href={`/edition/${edition.slug}`}
        className="flex items-center gap-[12px] transition-colors hover:bg-text/2"
      >
        <div className="shadow-edge h-[56px] w-[40px] flex-none overflow-hidden rounded-cover">
          <Cover
            couvertureUrl={edition.couvertureUrl}
            numero={edition.dernierNumeroPossede}
            titre={edition.titre}
            placeholderClassName={PLACEHOLDER_MANQUANTS}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <div className="flex items-center gap-[5px]">
            <span className="titre-serie truncate text-[14px] font-medium text-text">{edition.titre}</span>
            <IconeEtat edition={edition} />
          </div>
          <span className="truncate text-[11.5px] text-neutral-600">{sousTitre}</span>
        </div>

        <span className="text-[11.5px] font-medium whitespace-nowrap text-neutral-300">
          {edition.possedes} / {edition.tomesParus}
        </span>
      </Link>

      <ul className="mt-[9px] flex flex-wrap gap-[6px] pl-[52px]">
        {edition.manquants.map((numero) => (
          <li
            key={numero}
            className="bg-surface rounded-[3px] px-[7px] py-[2px] text-[11px] font-medium text-neutral-300"
          >
            {numero}
          </li>
        ))}
      </ul>
    </li>
  );
}
