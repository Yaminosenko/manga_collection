import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/cover";
import { ProgressBar } from "@/components/progress-bar";
import { ArrowLeft, ArrowUpRight, WarningCircle } from "@/components/icons";
import { chargerEdition } from "@/lib/editions";
import {
  aDesTomesAParaitre,
  dernierTomePossede,
  libelleStatut,
  valeurCentimes,
} from "@/lib/domain";
import { LIBELLE_A_VERIFIER, URL_FICHE_MANGA_NEWS } from "@/lib/constants";
import { formaterPrix } from "@/lib/format";

export const dynamic = "force-dynamic";

function sousTitre(nom: string, editeur: string | null): string {
  return editeur ? `${nom} · ${editeur}` : nom;
}

export default async function Page({ params }: PageProps<"/edition/[slug]">) {
  const { slug } = await params;
  const edition = await chargerEdition(slug);

  if (!edition) {
    notFound();
  }

  const possedes = edition.tomes.filter((tome) => tome.possede);
  const dernier = dernierTomePossede(edition.tomes);
  const aParaitre = aDesTomesAParaitre(edition.editionTerminee);
  const valeur = formaterPrix(valeurCentimes(edition));
  const compteur = `${possedes.length} / ${edition.tomesParus}`;

  return (
    <main className="flex min-h-dvh flex-col">
      <nav className="flex items-center justify-between px-[18px] py-[10px]">
        <Link href="/" aria-label="Retour" className="flex min-h-11 items-center text-accent">
          <ArrowLeft className="size-[18px]" />
        </Link>
      </nav>

      <div className="flex flex-1 flex-col gap-[20px] px-[18px] pb-[18px]">
        <header className="flex gap-[14px]">
          <div className="shadow-edge relative h-[104px] w-[74px] flex-none overflow-hidden rounded-cover-lg text-[13px]">
            <Cover
              couvertureUrl={edition.couvertureUrl ?? dernier?.couvertureUrl ?? null}
              numero={dernier?.numero ?? null}
              titre={edition.titre}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            <h1 className="text-[16px]/[1.2] font-medium text-text">{edition.titre}</h1>
            <p className="truncate text-[11.5px] text-neutral-600">
              {sousTitre(edition.nom, edition.editeur)}
            </p>

            {edition.aVerifier ? (
              <span className="mt-[2px] inline-flex items-center gap-[5px] self-start rounded-sm border border-neutral-800 px-[7px] py-[2px] text-[10px] font-medium text-neutral-400">
                <WarningCircle className="size-[11px]" />
                {LIBELLE_A_VERIFIER}
              </span>
            ) : null}

            <div className="mt-[7px] flex items-center gap-[9px]">
              <ProgressBar
                possedes={possedes.length}
                tomesParus={edition.tomesParus}
                aParaitre={aParaitre}
                hauteurClassName="h-[6px]"
                largeurAParaitreClassName="w-[22px]"
              />
              <span className="text-[12px] font-medium whitespace-nowrap text-text">
                {compteur}
              </span>
            </div>
          </div>
        </header>

        <Link
          href={`/edition/${edition.slug}/tomes`}
          className="flex min-h-11 w-full items-center justify-center rounded-md border border-accent text-[14px] font-medium tracking-[0.06em] text-accent uppercase transition-colors hover:bg-accent/12 active:bg-accent/22"
        >
          {compteur} tomes
        </Link>

        {possedes.length > 0 ? (
          <section className="flex flex-col gap-[9px]">
            <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
              Couvertures possédées
            </h2>
            <div className="flex gap-[9px] overflow-x-auto">
              {possedes.map((tome) => (
                <div
                  key={tome.numero}
                  className="shadow-edge h-[94px] w-[66px] flex-none overflow-hidden rounded-cover text-[11px]"
                >
                  <Cover
                    couvertureUrl={tome.couvertureUrl}
                    numero={tome.numero}
                    titre={edition.titre}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {edition.autresEditions.length > 0 ? (
          <section className="flex flex-col gap-[9px]">
            <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
              Autres éditions
            </h2>
            <div className="flex flex-col">
              {edition.autresEditions.map((autre) => (
                <Link
                  key={autre.slug}
                  href={`/edition/${autre.slug}`}
                  className="border-row-divider flex min-h-11 items-center gap-[12px] border-b py-[13px] last:border-b-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <span className="truncate text-[13px] font-medium text-text">
                      {sousTitre(autre.nom, autre.editeur)}
                    </span>
                    <span className="flex items-center gap-[8px]">
                      <ProgressBar
                        possedes={autre.possedes}
                        tomesParus={autre.tomesParus}
                        aParaitre={aDesTomesAParaitre(autre.editionTerminee)}
                        desature={autre.statut !== "EN_COURS"}
                      />
                      <span className="text-[11.5px] font-medium whitespace-nowrap text-neutral-300">
                        {autre.possedes} / {autre.tomesParus}
                      </span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="border-divider flex flex-col border-t pt-[12px] text-[12px]">
          <Ligne cle="Auteur" valeur={edition.auteur} />
          <Ligne cle="Genres" valeur={edition.genres.join(" · ")} />
          <Link
            href={`/edition/${edition.slug}/etat`}
            className="flex items-center justify-between gap-[12px] py-[7px] text-[12px]"
          >
            <span className="flex-none text-neutral-600">Statut</span>
            <span className="flex items-center gap-[6px] text-right text-accent">
              {libelleStatut(edition, possedes.length)}
              <ArrowUpRight className="size-[11px]" />
            </span>
          </Link>
          <Ligne cle="Valeur" valeur={valeur} />

          {edition.slugMangaNews ? (
            <a
              href={`${URL_FICHE_MANGA_NEWS}${edition.slugMangaNews}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-[6px] text-[12px] font-medium text-accent"
            >
              Fiche manga-news
              <ArrowUpRight className="size-[12px]" />
            </a>
          ) : null}
        </footer>
      </div>
    </main>
  );
}

function Ligne({ cle, valeur }: { cle: string; valeur: string | null }) {
  if (!valeur) {
    return null;
  }
  return (
    <div className="flex justify-between gap-[12px] py-[7px]">
      <span className="flex-none text-neutral-600">{cle}</span>
      <span className="text-right text-neutral-300">{valeur}</span>
    </div>
  );
}
