"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { ajouterCandidat, preparerCandidat, rechercherAuCatalogue } from "@/lib/actions";
import { ArrowLeft, CaretRight, MagnifyingGlass } from "@/components/icons";
import {
  ACTION_AJOUTER,
  ACTION_SUIVRE,
  DELAI_RECHERCHE_MS,
  LIBELLE_ACTION_AJOUTER,
  LIBELLE_ACTION_SUIVRE,
  LIBELLE_AU_CATALOGUE,
  LIBELLE_CANDIDAT_EN_PREPARATION,
  LIBELLE_CANDIDAT_PREPARE,
  LIBELLE_DEJA_EN_COLLECTION,
  LIBELLE_INVITE_RECHERCHE,
  LIBELLE_ONE_SHOT_DEDUIT,
  LIBELLE_RECHERCHE_VIDE,
  LIBELLE_TOMES_DU_CATALOGUE,
  LIBELLE_TOME_DU_CATALOGUE,
  LONGUEUR_RECHERCHE_MIN,
  MENTION_ACTIONS_CANDIDAT,
  MENTION_TOME_SCANNE,
  PARAM_ISBN,
  PARAM_MARQUEUR,
  PARAM_SERIE,
  PLACEHOLDER_RECHERCHE,
  TITRE_RECHERCHER,
  TITRE_SCANNER,
  TOMES_PARUS_MAX,
} from "@/lib/constants";
import { formaterPrix } from "@/lib/format";
import type {
  CandidatEdition,
  CandidatPrepare,
  EtatCreation,
  ResultatRecherche,
} from "@/lib/domain";

const RECHERCHE_VIDE: ResultatRecherche = { locales: [], candidats: [] };

const CHAMP =
  "bg-surface w-full rounded-md px-[12px] py-[9px] text-[13px] text-text outline-none placeholder:text-neutral-600";
const ETIQUETTE = "flex flex-col gap-[5px] text-[11.5px] text-neutral-500";
const SECTION = "text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase";

export function SearchSeries() {
  const parametres = useSearchParams();
  const serieDemandee = parametres.get(PARAM_SERIE);
  const marqueurDemande = parametres.get(PARAM_MARQUEUR);
  const isbnScanne = parametres.get(PARAM_ISBN);
  const [terme, setTerme] = useState("");
  const [recherche, setRecherche] = useState<ResultatRecherche>(RECHERCHE_VIDE);
  const [chargement, demarrerRecherche] = useTransition();
  const [prepare, setPrepare] = useState<CandidatPrepare | null>(null);
  const [preparation, demarrerPreparation] = useTransition();

  useEffect(() => {
    const requete = terme.trim();
    if (requete.length < LONGUEUR_RECHERCHE_MIN) {
      return;
    }
    let courante = true;
    const minuteur = setTimeout(() => {
      demarrerRecherche(async () => {
        const trouvees = await rechercherAuCatalogue(requete);
        if (courante) {
          setRecherche(trouvees);
        }
      });
    }, DELAI_RECHERCHE_MS);
    return () => {
      courante = false;
      clearTimeout(minuteur);
    };
  }, [terme]);

  useEffect(() => {
    if (serieDemandee === null) {
      return;
    }
    let courant = true;
    demarrerPreparation(async () => {
      const complet = await preparerCandidat(serieDemandee, marqueurDemande);
      if (courant && complet) {
        setPrepare(complet);
      }
    });
    return () => {
      courant = false;
    };
  }, [serieDemandee, marqueurDemande]);

  function choisir(candidat: CandidatEdition) {
    demarrerPreparation(async () => {
      const complet = await preparerCandidat(candidat.serieNormalise, candidat.marqueurNormalise);
      if (complet) {
        setPrepare(complet);
      }
    });
  }

  if (prepare) {
    return (
      <Confirmation
        prepare={prepare}
        isbnScanne={isbnScanne}
        onRetour={() => setPrepare(null)}
      />
    );
  }

  const requeteCourte = terme.trim().length < LONGUEUR_RECHERCHE_MIN;
  const resultats = requeteCourte ? RECHERCHE_VIDE : recherche;
  const aucunResultat =
    !requeteCourte &&
    !chargement &&
    resultats.locales.length === 0 &&
    resultats.candidats.length === 0;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col gap-[12px] px-[18px] pt-[14px] pb-[10px]">
        <div className="flex items-center justify-between gap-[12px]">
          <h1 className="text-text text-[20px] font-medium">{TITRE_RECHERCHER}</h1>
          <Link
            href="/scanner"
            className="border-accent text-accent flex min-h-11 items-center rounded-md border px-[12px] text-[12.5px] font-medium transition-colors hover:bg-accent/12"
          >
            {TITRE_SCANNER}
          </Link>
        </div>
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
            <h2 className={SECTION}>{LIBELLE_DEJA_EN_COLLECTION}</h2>
            {resultats.locales.map((locale) => (
              <Link
                key={locale.slug}
                href={`/edition/${locale.slug}`}
                className="border-row-divider flex min-h-11 items-center gap-[10px] border-b py-[10px]"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="titre-serie truncate text-[14px] font-medium text-text">
                    {locale.titre}
                  </span>
                  <span className="truncate text-[11.5px] text-neutral-600">
                    {locale.nom} · {locale.possedes} / {locale.tomesParus}
                  </span>
                </span>
                <CaretRight className="size-[14px] flex-none text-neutral-600" />
              </Link>
            ))}
          </section>
        ) : null}

        {resultats.candidats.length > 0 ? (
          <section className="flex flex-col gap-[4px]">
            <h2 className={SECTION}>{LIBELLE_AU_CATALOGUE}</h2>
            {resultats.candidats.map((candidat) => (
              <button
                key={`${candidat.serieNormalise}-${candidat.marqueurNormalise ?? ""}`}
                type="button"
                disabled={preparation}
                onClick={() => choisir(candidat)}
                className="border-row-divider flex min-h-11 items-center gap-[10px] border-b py-[10px] text-left disabled:opacity-50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="titre-serie truncate text-[14px] font-medium text-text">
                    {candidat.titre}
                  </span>
                  <span className="truncate text-[11.5px] text-neutral-600">
                    {candidat.nom}
                    {candidat.editeur ? ` · ${candidat.editeur}` : ""}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {candidat.tomesParus}{" "}
                    {candidat.tomesParus === 1
                      ? LIBELLE_TOME_DU_CATALOGUE
                      : LIBELLE_TOMES_DU_CATALOGUE}
                    {candidat.slugEnCollection ? ` · ${LIBELLE_DEJA_EN_COLLECTION}` : ""}
                  </span>
                </span>
                <CaretRight className="size-[14px] flex-none text-neutral-600" />
              </button>
            ))}
          </section>
        ) : null}

        {preparation ? (
          <p className="text-[11.5px] text-neutral-500">{LIBELLE_CANDIDAT_EN_PREPARATION}</p>
        ) : null}
      </div>
    </main>
  );
}

function Confirmation({
  prepare,
  isbnScanne,
  onRetour,
}: {
  prepare: CandidatPrepare;
  isbnScanne: string | null;
  onRetour: () => void;
}) {
  const [etat, action, enCours] = useActionState<EtatCreation, FormData>(ajouterCandidat, {
    erreur: null,
  });
  const { candidat } = prepare;
  const oneShotDeduit = prepare.tomesConnus === 0 || candidat.tomesParus === 1;

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
          <span className="titre-serie truncate text-[14px] font-medium text-text">
            {candidat.titre}
          </span>
          <span className="truncate text-[11px] text-neutral-600">{candidat.nom}</span>
        </div>
      </header>

      <form action={action} className="flex flex-1 flex-col gap-[12px] px-[18px] pb-[18px]">
        <input type="hidden" name="serieNormalise" value={candidat.serieNormalise} />
        <input
          type="hidden"
          name="marqueurNormalise"
          value={candidat.marqueurNormalise ?? ""}
        />
        <input type="hidden" name="isbnPossede" value={isbnScanne ?? ""} />

        <p className="text-[11px]/[1.5] text-neutral-600">
          {LIBELLE_CANDIDAT_PREPARE} {prepare.tomesAvecEan} tome
          {prepare.tomesAvecEan === 1 ? "" : "s"} portent un ISBN
          {prepare.annonces > 0
            ? `, ${prepare.annonces} sortie${prepare.annonces === 1 ? "" : "s"} annoncée${prepare.annonces === 1 ? "" : "s"}`
            : ""}
          .
        </p>

        <label className={ETIQUETTE}>
          Titre
          <input name="titre" defaultValue={candidat.titre} required className={CHAMP} />
        </label>

        <label className={ETIQUETTE}>
          Auteur
          <input
            name="auteur"
            defaultValue={prepare.auteur}
            placeholder="Non trouvé à la BnF"
            required
            className={CHAMP}
          />
        </label>

        <label className={ETIQUETTE}>
          Nom d’édition
          <input name="nom" defaultValue={candidat.nom} required className={CHAMP} />
        </label>

        <label className={ETIQUETTE}>
          Éditeur
          <input
            name="editeur"
            defaultValue={prepare.editeur ?? ""}
            placeholder="Non renseigné"
            className={CHAMP}
          />
        </label>

        <label className={ETIQUETTE}>
          Tomes parus en France
          <input
            name="tomesParus"
            type="number"
            min={1}
            max={TOMES_PARUS_MAX}
            step={1}
            defaultValue={candidat.tomesParus}
            required
            className={CHAMP}
          />
          {oneShotDeduit ? (
            <span className="text-[10.5px]/[1.5] text-neutral-600">{LIBELLE_ONE_SHOT_DEDUIT}</span>
          ) : null}
        </label>

        <label className={ETIQUETTE}>
          Prix par défaut
          <input
            name="prixDefaut"
            inputMode="decimal"
            placeholder="6,90"
            defaultValue={
              prepare.prixDefautCentimes === null
                ? ""
                : (prepare.prixDefautCentimes / 100).toFixed(2).replace(".", ",")
            }
            className={CHAMP}
          />
          {prepare.prixDefautCentimes !== null ? (
            <span className="text-[10.5px] text-neutral-600">
              {formaterPrix(prepare.prixDefautCentimes)} relevé à la BnF
            </span>
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
          <input
            name="editionTerminee"
            type="checkbox"
            defaultChecked={candidat.editionTerminee}
            className="size-[16px] accent-accent"
          />
          Édition terminée en France
        </label>

        {etat.erreur ? <p className="text-[11.5px] text-neutral-400">{etat.erreur}</p> : null}

        <p className="mt-[4px] text-[11px]/[1.5] text-neutral-600">
          {isbnScanne !== null ? MENTION_TOME_SCANNE : MENTION_ACTIONS_CANDIDAT}
        </p>

        <div className="flex gap-[9px]">
          <button
            type="submit"
            name="action"
            value={ACTION_SUIVRE}
            disabled={enCours}
            className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-neutral-800 text-[13px] font-medium text-neutral-300 uppercase transition-colors hover:border-accent-600 hover:text-accent-200 disabled:opacity-45"
          >
            {LIBELLE_ACTION_SUIVRE}
          </button>
          <button
            type="submit"
            name="action"
            value={ACTION_AJOUTER}
            disabled={enCours}
            className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-accent text-[13px] font-medium tracking-[0.06em] text-accent uppercase transition-colors hover:bg-accent/12 disabled:opacity-45"
          >
            {LIBELLE_ACTION_AJOUTER}
          </button>
        </div>
      </form>
    </main>
  );
}
