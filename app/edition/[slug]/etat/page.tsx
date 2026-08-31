import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { EditionState } from "@/components/edition-state";
import { chargerEdition } from "@/lib/editions";
import { estProprietaire } from "@/lib/guard";
import { TITRE_ETAT } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/edition/[slug]/etat">) {
  const { slug } = await params;
  const edition = await chargerEdition(slug);

  if (!edition || !(await estProprietaire())) {
    notFound();
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-[12px] px-[18px] pt-[22px] pb-[20px]">
        <Link
          href={`/edition/${edition.slug}`}
          aria-label="Retour à l'édition"
          className="flex min-h-11 items-center text-accent"
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="titre-serie truncate text-[14px] font-medium text-text">{edition.titre}</span>
          <span className="truncate text-[11px] text-neutral-600">
            {edition.nom} · {TITRE_ETAT}
          </span>
        </div>
      </header>

      <EditionState
        slug={edition.slug}
        statut={edition.statut}
        editionTerminee={edition.editionTerminee}
        termineeForcee={edition.termineeForcee}
      />
    </main>
  );
}
