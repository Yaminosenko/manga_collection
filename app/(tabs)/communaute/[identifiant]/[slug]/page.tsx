import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { VolumeGrid } from "@/components/volume-grid";
import { compteParIdentifiant } from "@/lib/communaute";
import { chargerTomesDe } from "@/lib/editions";
import { aDesTomesAParaitre } from "@/lib/domain";
import { exigerAcces } from "@/lib/guard";
import { CHEMIN_COMMUNAUTE, LIBELLE_RETOUR_COLLECTION_VISITEE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/communaute/[identifiant]/[slug]">) {
  await exigerAcces();

  const { identifiant, slug } = await params;
  const compte = await compteParIdentifiant(identifiant);

  if (!compte) {
    notFound();
  }

  const edition = await chargerTomesDe(slug, compte.id);

  if (!edition) {
    notFound();
  }

  const sousTitre = `${compte.nomVisible} · ${edition.nom} · ${edition.tomesParus} tomes parus`;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-[12px] px-[18px] pt-[22px] pb-[14px]">
        <Link
          href={`${CHEMIN_COMMUNAUTE}/${compte.identifiant}`}
          aria-label={LIBELLE_RETOUR_COLLECTION_VISITEE}
          className="flex min-h-11 items-center text-accent"
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="titre-serie truncate text-[14px] font-medium text-text">{edition.titre}</span>
          <span className="truncate text-[11px] text-neutral-600">{sousTitre}</span>
        </div>
      </header>

      <VolumeGrid
        slug={edition.slug}
        titre={edition.titre}
        tomesParus={edition.tomesParus}
        aParaitre={aDesTomesAParaitre(edition.editionTerminee)}
        sorties={edition.sorties}
        tomes={edition.tomes}
        lectureSeule
      />
    </main>
  );
}
