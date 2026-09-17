import { MissingGroup } from "@/components/missing-group";
import { LIBELLE_AUCUN_MANQUANT, LIBELLE_AUCUN_RESULTAT } from "@/lib/constants";
import type { EditionManquante, Manquants } from "@/lib/domain";

type MissingPanelProps = {
  manquants: Manquants;
  editions: EditionManquante[];
};

export function MissingPanel({ manquants, editions }: MissingPanelProps) {
  const vide = manquants.editions.length === 0;

  return (
    <>
      {vide ? (
        <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_AUCUN_MANQUANT}</p>
      ) : null}

      {!vide && editions.length === 0 ? (
        <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_AUCUN_RESULTAT}</p>
      ) : null}

      {editions.length > 0 ? (
        <ul className="flex flex-col">
          {editions.map((edition) => (
            <MissingGroup key={edition.slug} edition={edition} />
          ))}
        </ul>
      ) : null}
    </>
  );
}
