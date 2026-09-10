import { CollapsibleSection } from "@/components/collapsible-section";
import { CollectionRow } from "@/components/collection-row";
import {
  LIBELLE_AUCUN_RESULTAT,
  LIBELLE_COLLECTION_VIDE,
  LIBELLE_VENDUES,
  PREFIXE_VALEUR_PARTIELLE,
} from "@/lib/constants";
import { formaterNombre, formaterPrix } from "@/lib/format";
import type { Collection, LigneCollection } from "@/lib/domain";

type CollectionPanelProps = {
  collection: Collection;
  lignes: LigneCollection[];
  vendues: LigneCollection[];
};

export function CollectionPanel({ collection, lignes, vendues }: CollectionPanelProps) {
  const vide = collection.lignes.length === 0 && collection.vendues.length === 0;

  return (
    <>
      {vide ? null : (
        <div className="flex items-baseline justify-between gap-[12px] pb-[8px]">
          <span className="text-[11.5px] text-neutral-500">
            {formaterNombre(collection.tomesPossedes)} tomes ·{" "}
            {formaterNombre(collection.nombreEditions)} éditions
          </span>
          <span className="text-accent text-[13px] font-medium whitespace-nowrap">
            {collection.tomesSansPrix > 0 ? PREFIXE_VALEUR_PARTIELLE : ""}
            {formaterPrix(collection.valeurCentimes)}
          </span>
        </div>
      )}

      {vide ? (
        <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_COLLECTION_VIDE}</p>
      ) : null}

      {!vide && lignes.length === 0 && vendues.length === 0 ? (
        <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_AUCUN_RESULTAT}</p>
      ) : null}

      {lignes.map((ligne) => (
        <CollectionRow key={ligne.slug} ligne={ligne} />
      ))}

      {vendues.length > 0 ? (
        <CollapsibleSection libelle={LIBELLE_VENDUES} compteur={vendues.length}>
          {vendues.map((ligne) => (
            <CollectionRow key={ligne.slug} ligne={ligne} />
          ))}
        </CollapsibleSection>
      ) : null}
    </>
  );
}
