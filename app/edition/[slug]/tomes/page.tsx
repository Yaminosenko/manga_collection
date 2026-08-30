import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { VolumeGrid } from "@/components/volume-grid";
import { chargerEdition } from "@/lib/editions";
import { aDesTomesAParaitre } from "@/lib/domain";
import { estProprietaire } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/edition/[slug]/tomes">) {
  const { slug } = await params;
  const edition = await chargerEdition(slug);
  const proprietaire = await estProprietaire();

  if (!edition) {
    notFound();
  }

  const sousTitre = `${edition.nom} · ${edition.tomesParus} tomes parus`;

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-[12px] px-[18px] pt-[22px] pb-[14px]">
        <Link
          href={`/edition/${edition.slug}`}
          aria-label="Retour à l'édition"
          className="flex min-h-11 items-center text-accent"
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-medium text-text">{edition.titre}</span>
          <span className="truncate text-[11px] text-neutral-600">{sousTitre}</span>
        </div>
      </header>

      <VolumeGrid
        slug={edition.slug}
        titre={edition.titre}
        tomesParus={edition.tomesParus}
        aParaitre={aDesTomesAParaitre(edition.editionTerminee)}
        lectureSeule={!proprietaire}
        sorties={edition.sorties}
        tomes={edition.tomes}
      />
    </main>
  );
}
