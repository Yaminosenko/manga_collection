import { CollapsibleSection } from "@/components/collapsible-section";
import { CollectionRow } from "@/components/collection-row";
import {
  LIBELLE_AUCUN_RESULTAT,
  LIBELLE_COLLECTION_VIDE,
  LIBELLE_VENDUES,
} from "@/lib/constants";
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
