import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionRow } from "@/components/collection-row";
import { PanelStats } from "@/components/panel-stats";
import { ArrowLeft } from "@/components/icons";
import { compteParIdentifiant } from "@/lib/communaute";
import { chargerEspaceCollectionDe } from "@/lib/editions";
import { exigerAcces } from "@/lib/guard";
import {
  CHEMIN_COMMUNAUTE,
  LIBELLE_COLLECTION_VIDE_AUTRE,
  LIBELLE_COMPTEUR_EDITIONS,
  LIBELLE_COMPTEUR_TOMES,
  LIBELLE_RETOUR_COMMUNAUTE,
  MENTION_COLLECTION_LECTURE_SEULE,
} from "@/lib/constants";
import { formaterNombre } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/communaute/[identifiant]">) {
  await exigerAcces();

  const { identifiant } = await params;
  const compte = await compteParIdentifiant(identifiant);

  if (!compte) {
    notFound();
  }

  const { collection } = await chargerEspaceCollectionDe(compte.id);
  const stats = [
    { valeur: formaterNombre(collection.tomesPossedes), libelle: LIBELLE_COMPTEUR_TOMES },
    { valeur: formaterNombre(collection.nombreEditions), libelle: LIBELLE_COMPTEUR_EDITIONS },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <nav className="flex items-center justify-between px-[18px] py-[10px]">
        <Link
          href={CHEMIN_COMMUNAUTE}
          aria-label={LIBELLE_RETOUR_COMMUNAUTE}
          className="text-accent flex min-h-11 items-center"
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
      </nav>

      <div className="flex flex-1 flex-col px-[18px] pb-[18px]">
        <h1 className="text-text text-[22px] font-semibold">{compte.nomVisible}</h1>
        <p className="pt-[4px] pb-[10px] text-[12px] text-neutral-600">
          {MENTION_COLLECTION_LECTURE_SEULE}
        </p>

        {collection.lignes.length === 0 ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_COLLECTION_VIDE_AUTRE}</p>
        ) : (
          <>
            <PanelStats stats={stats} prix={null} />
            {collection.lignes.map((ligne) => (
              <CollectionRow key={ligne.slug} ligne={ligne} inerte />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
