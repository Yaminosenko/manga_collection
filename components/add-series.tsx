"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Cover } from "@/components/cover";
import { ArrowLeft, MagnifyingGlass, WarningCircle } from "@/components/icons";
import { chercherPrix, creerEdition, rechercherSeries } from "@/lib/actions";
import {
  DELAI_RECHERCHE_MS,
  LIBELLE_ANILIST_INDISPONIBLE,
  LIBELLE_DEJA_EN_COLLECTION,
  LIBELLE_INVITE_RECHERCHE,
  LIBELLE_PRIX_RECHERCHE,
  LIBELLE_PRIX_SUGGERE,
  LIBELLE_RECHERCHE_VIDE,
  LIBELLE_TOMES_JAPONAIS,
  LONGUEUR_RECHERCHE_MIN,
  NOM_EDITION_PAR_DEFAUT,
  PLACEHOLDER_RECHERCHE,
  TITRE_AJOUTER,
} from "@/lib/constants";
import type { EtatCreation, ResultatDistant, ResultatRecherche } from "@/lib/domain";

const RECHERCHE_VIDE: ResultatRecherche = { locales: [], distantes: [], indisponible: false };

const CHAMP =
  "bg-surface w-full rounded-md px-[12px] py-[9px] text-[13px] text-text outline-none placeholder:text-neutral-600";
const ETIQUETTE = "flex flex-col gap-[5px] text-[11.5px] text-neutral-500";

export function AddSeries() {
  const [terme, setTerme] = useState("");
  const [recherche, setRecherche] = useState<ResultatRecherche>(RECHERCHE_VIDE);
  const [chargement, demarrerRecherche] = useTransition();
  const [choisie, setChoisie] = useState<ResultatDistant | null>(null);

  useEffect(() => {
    const requete = terme.trim();
    if (requete.length < LONGUEUR_RECHERCHE_MIN) {
      return;
    }
    const minuteur = setTimeout(() => {
      demarrerRecherche(async () => {
        setRecherche(await rechercherSeries(requete));
      });
    }, DELAI_RECHERCHE_MS);
    return () => clearTimeout(minuteur);
  }, [terme]);

  if (choisie) {
    return <Confirmation serie={choisie} onRetour={() => setChoisie(null)} />;
  }

  const requeteCourte = terme.trim().length < LONGUEUR_RECHERCHE_MIN;
  const resultats = requeteCourte ? RECHERCHE_VIDE : recherche;
  const aucunResultat =
    !requeteCourte &&
    !chargement &&
    resultats.locales.length === 0 &&
    resultats.distantes.length === 0;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col gap-[12px] px-[18px] pt-[14px] pb-[10px]">
        <h1 className="text-[20px] font-medium text-text">{TITRE_AJOUTER}</h1>
        <label className="bg-surface flex h-[38px] items-center gap-[8px] rounded-md px-[12px]">
          <MagnifyingGlass className="size-[15px] flex-none text-neutral-500" />
          <input
            type="search"
            autoFocus
            value={terme}
            onChange={(evenement) => setTerme(evenement.target.value)}
            placeholder={PLACEHOLDER_RECHERCHE}
            className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-neutral-500"
          />
        </label>
      </header>

      <div className="flex flex-1 flex-col gap-[18px] px-[18px] pb-[18px]">
        {requeteCourte ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_INVITE_RECHERCHE}</p>
        ) : null}

        {aucunResultat ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_RECHERCHE_VIDE}</p>
        ) : null}

        {resultats.locales.length > 0 ? (
          <section className="flex flex-col gap-[4px]">
            <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
              {LIBELLE_DEJA_EN_COLLECTION}
            </h2>
            {resultats.locales.map((locale) => (
              <Link
                key={locale.slug}
                href={`/edition/${locale.slug}`}
                className="border-row-divider flex min-h-11 flex-col justify-center gap-[3px] border-b py-[10px]"
              >
                <span className="truncate text-[14px] font-medium text-text">{locale.titre}</span>
                <span className="truncate text-[11.5px] text-neutral-600">
                  {locale.nom} · {locale.possedes} / {locale.tomesParus}
                </span>
              </Link>
            ))}
          </section>
        ) : null}

        {resultats.indisponible ? (
          <p className="flex items-center gap-[6px] text-[11.5px] text-neutral-500">
            <WarningCircle className="size-[13px] flex-none" />
            {LIBELLE_ANILIST_INDISPONIBLE}
          </p>
        ) : null}

        {resultats.distantes.length > 0 ? (
          <section className="flex flex-col gap-[4px]">
            <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
              Résultats
            </h2>
            {resultats.distantes.map((distante) => (
              <button
                key={distante.id}
                type="button"
                onClick={() => setChoisie(distante)}
                className="border-row-divider flex items-center gap-[12px] border-b py-[10px] text-left"
              >
                <div className="shadow-edge h-[56px] w-[40px] flex-none overflow-hidden rounded-cover">
                  <Cover
                    couvertureUrl={distante.couvertureUrl}
                    numero={null}
                    titre={distante.titre}
                  />
                </div>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-[14px] font-medium text-text">
                    {distante.titre}
                  </span>
                  <span className="truncate text-[11.5px] text-neutral-600">
                    {[distante.auteur, distante.annee].filter(Boolean).join(" · ")}
                  </span>
                  {distante.dejaEnCollection ? (
                    <span className="text-[10.5px] text-neutral-500">
                      {LIBELLE_DEJA_EN_COLLECTION}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Confirmation({
  serie,
  onRetour,
}: {
  serie: ResultatDistant;
  onRetour: () => void;
}) {
  const [etat, action, enCours] = useActionState<EtatCreation, FormData>(creerEdition, {
    erreur: null,
  });
  const [prix, setPrix] = useState<number | null>(null);
  const [prixCherche, demarrerPrix] = useTransition();

  useEffect(() => {
    demarrerPrix(async () => {
      setPrix(await chercherPrix(serie.titre, serie.auteur));
    });
  }, [serie.titre, serie.auteur]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-[12px] px-[18px] pt-[22px] pb-[14px]">
        <button
          type="button"
          onClick={onRetour}
          aria-label="Retour à la recherche"
          className="flex min-h-11 items-center text-accent"
        >
          <ArrowLeft className="size-[18px]" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-medium text-text">{serie.titre}</span>
          <span className="truncate text-[11px] text-neutral-600">Confirmer l’édition</span>
        </div>
      </header>

      <form action={action} className="flex flex-1 flex-col gap-[12px] px-[18px] pb-[18px]">
        <input type="hidden" name="titreVo" value={serie.titreVo ?? ""} />
        <input type="hidden" name="genres" value={serie.genres.join(", ")} />

        <label className={ETIQUETTE}>
          Titre
          <input name="titre" defaultValue={serie.titre} required className={CHAMP} />
        </label>

        <label className={ETIQUETTE}>
          Auteur
          <input name="auteur" defaultValue={serie.auteur} required className={CHAMP} />
        </label>

        <label className={ETIQUETTE}>
          Nom d’édition
          <input
            name="nom"
            defaultValue={NOM_EDITION_PAR_DEFAUT}
            required
            className={CHAMP}
          />
        </label>

        <label className={ETIQUETTE}>
          Éditeur
          <input name="editeur" placeholder="Non renseigné" className={CHAMP} />
        </label>

        <label className={ETIQUETTE}>
          Tomes parus en France
          <input
            name="tomesParus"
            type="number"
            min={1}
            step={1}
            defaultValue={serie.volumesJaponais ?? 1}
            required
            className={CHAMP}
          />
          <span className="text-[10.5px] text-neutral-600">{LIBELLE_TOMES_JAPONAIS}</span>
        </label>

        <label className={ETIQUETTE}>
          Prix par défaut
          <input
            key={prix ?? "vide"}
            name="prixDefaut"
            inputMode="decimal"
            placeholder="6,90"
            defaultValue={prix === null ? "" : (prix / 100).toFixed(2).replace(".", ",")}
            className={CHAMP}
          />
          {prixCherche ? (
            <span className="text-[10.5px] text-neutral-600">{LIBELLE_PRIX_RECHERCHE}</span>
          ) : prix !== null ? (
            <span className="text-[10.5px] text-neutral-600">{LIBELLE_PRIX_SUGGERE}</span>
          ) : null}
        </label>

        <label className={ETIQUETTE}>
          Statut
          <select name="statut" defaultValue="EN_COURS" className={CHAMP}>
            <option value="EN_COURS">En cours</option>
            <option value="EN_PAUSE">En pause</option>
            <option value="ABANDONNEE">Abandonnée</option>
            <option value="VENDUE">Vendue</option>
          </select>
        </label>

        <label className="flex items-center gap-[8px] text-[13px] text-neutral-300">
          <input name="editionTerminee" type="checkbox" className="size-[16px] accent-accent" />
          Édition terminée en France
        </label>

        {etat.erreur ? (
          <p className="text-[11.5px] text-neutral-400">{etat.erreur}</p>
        ) : null}

        <button
          type="submit"
          disabled={enCours}
          className="mt-[6px] flex min-h-11 w-full items-center justify-center rounded-md border border-accent text-[14px] font-medium tracking-[0.06em] text-accent uppercase transition-colors hover:bg-accent/12 disabled:opacity-45"
        >
          {enCours ? "Ajout…" : "Ajouter à la collection"}
        </button>
      </form>
    </main>
  );
}
