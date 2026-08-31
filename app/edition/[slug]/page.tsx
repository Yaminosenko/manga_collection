import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/cover";
import { ProgressBar } from "@/components/progress-bar";
import { ArrowLeft, ArrowUpRight, CaretRight, WarningCircle } from "@/components/icons";
import { chargerEdition } from "@/lib/editions";
import { estProprietaire } from "@/lib/guard";
import {
  aDesTomesAParaitre,
  dernierTomePossede,
  libelleStatut,
  valeurCentimes,
} from "@/lib/domain";
import {
  LIBELLE_A_VERIFIER,
  LIBELLE_AUTRES_EDITIONS,
  LIBELLE_FICHE_MANGA_NEWS,
  LIBELLE_MODIFIER_ETAT,
  LIBELLE_PRIX_TOME,
  LIBELLE_PROCHAINE_SORTIE,
  LIBELLE_TOMES_POSSEDES,
  URL_RECHERCHE_MANGA_NEWS,
} from "@/lib/constants";
import { formaterDateComplete, formaterPrix } from "@/lib/format";

export const dynamic = "force-dynamic";

function sousTitre(nom: string, editeur: string | null): string {
  return editeur ? `${nom} · ${editeur}` : nom;
}

export default async function Page({ params }: PageProps<"/edition/[slug]">) {
  const { slug } = await params;
  const edition = await chargerEdition(slug);
  const proprietaire = await estProprietaire();

  if (!edition) {
    notFound();
  }

  const possedes = edition.tomes.filter((tome) => tome.possede);
  const dernier = dernierTomePossede(edition.tomes);
  const aParaitre = aDesTomesAParaitre(edition.editionTerminee);
  const valeur = formaterPrix(valeurCentimes(edition));
  const compteur = `${possedes.length} / ${edition.tomesParus}`;
  const prochaine = edition.sorties.at(0) ?? null;

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
            <h1 className="titre-serie text-[16px]/[1.2] font-medium text-text">{edition.titre}</h1>
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
              {LIBELLE_TOMES_POSSEDES}
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
              {LIBELLE_AUTRES_EDITIONS}
            </h2>
            <div className="flex flex-col">
              {edition.autresEditions.map((autre) => (
                <Link
                  key={autre.slug}
                  href={`/edition/${autre.slug}`}
                  className="border-row-divider flex min-h-11 items-center gap-[12px] border-b py-[9px] transition-colors last:border-b-0 hover:bg-text/2"
                >
                  <span
                    className={`shadow-edge h-[74px] w-[52px] flex-none overflow-hidden rounded-cover text-[11px] ${
                      autre.statut === "EN_COURS" ? "" : "opacity-50"
                    }`}
                  >
                    <Cover
                      couvertureUrl={autre.couvertureUrl}
                      numero={autre.dernierNumeroPossede}
                      titre={edition.titre}
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <span className="truncate text-[13px] font-medium text-text">{autre.nom}</span>
                    {autre.editeur ? (
                      <span className="truncate text-[11.5px] text-neutral-600">
                        {autre.editeur}
                      </span>
                    ) : null}
                    <span className="mt-[3px] flex items-center gap-[8px]">
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
                  <CaretRight className="size-[14px] flex-none text-neutral-600" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {prochaine ? (
          <section className="flex flex-col gap-[9px]">
            <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
              {LIBELLE_PROCHAINE_SORTIE}
            </h2>
            <div className="border-row-divider flex items-center gap-[12px] border-b py-[9px]">
              <span className="shadow-edge h-[74px] w-[52px] flex-none overflow-hidden rounded-cover text-[11px]">
                <Cover
                  couvertureUrl={prochaine.couvertureUrl}
                  numero={prochaine.numero}
                  titre={edition.titre}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                <span className="text-[13px] font-medium text-text">Tome {prochaine.numero}</span>
                {edition.editeur ? (
                  <span className="truncate text-[11.5px] text-neutral-600">{edition.editeur}</span>
                ) : null}
                <span className="text-accent mt-[2px] text-[12.5px] font-medium">
                  {formaterDateComplete(prochaine.date)}
                </span>
              </span>
            </div>
          </section>
        ) : null}

        <footer className="border-divider flex flex-col border-t pt-[12px] text-[12px]">
          <Ligne cle="Auteur" valeur={edition.auteur} />
          <Ligne cle="Genres" valeur={edition.genres.join(" · ")} />
          <Ligne cle="Statut" valeur={libelleStatut(edition, possedes.length)} />
          <Ligne cle={LIBELLE_PRIX_TOME} valeur={formaterPrix(edition.prixDefautCentimes)} />
          <Ligne cle="Valeur" valeur={valeur} />

          <a
            href={`${URL_RECHERCHE_MANGA_NEWS}${encodeURIComponent(edition.titre)}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-[6px] text-[12px] font-medium text-accent"
          >
            {LIBELLE_FICHE_MANGA_NEWS}
            <ArrowUpRight className="size-[12px]" />
          </a>
        </footer>

        {proprietaire ? (
          <Link
            href={`/edition/${edition.slug}/etat`}
            className="flex min-h-11 w-full items-center justify-center gap-[8px] rounded-md border border-neutral-800 text-[13px] font-medium tracking-[0.06em] text-neutral-300 uppercase transition-colors hover:border-accent-600 hover:text-accent-200"
          >
            {LIBELLE_MODIFIER_ETAT}
            <CaretRight className="size-[12px]" />
          </Link>
        ) : null}
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
