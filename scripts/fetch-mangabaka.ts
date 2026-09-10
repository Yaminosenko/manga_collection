import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { convertir, liensDe, rechercherSurMangaBaka, serieCompleteParId } from "../lib/mangabaka";
import type { LienMangaBaka, SerieMangaBaka } from "../lib/mangabaka";
import { normaliserAlias, similarite } from "../lib/normalisation";
import {
  DETAILS_MANGABAKA_PAR_MINUTE,
  RECHERCHES_MANGABAKA_PAR_MINUTE,
} from "../lib/constants";

const MANIFESTE = join(process.cwd(), "data", "mangabaka.json");
const SCORE_A_RELIRE = 0.6;
const RECALCULER = "--recalculer";

const ABSENTES_DE_MANGABAKA = new Set([
  "les-legendaires-saga",
  "my-hero-academia-ultra-archive",
  "pandora-heart-8-5",
]);

const RECHERCHES_MANUELLES: Record<string, string> = {
  "ippo-s4-la-loi-du-ring": "Hajime no Ippo",
  "jk-haru-sex-worker-in-another-world": "JK Haru is a Sex Worker in Another World",
  "l-atelier-des-sorciers-edition-grimoire": "Witch Hat Atelier",
  "kaijin-reijoh": "Kaijin Reijou",
  "kaiju-n8": "Kaijuu 8-gou",
  "marimashita-iruma-kun": "Mairimashita! Iruma-kun",
  "mirai-nikki-le-journal-du-futur": "Mirai Nikki",
  "monster-musume-everyday-life-with-monster-girls": "Monster Musume no Iru Nichijou",
  "mushoku-tensei": "Mushoku Tensei : Nouvelle vie, nouvelle chance",
  "mushoku-tensei-l-epee-d-iris": "Mushoku Tensei - L'Épée d'Eris",
  "nier-automata-op-pearl-harbor": "YoRHa: Shinjuwan Kouka Sakusen Kiroku",
  "one-puch-man": "One Punch-Man",
  "oriant-samurai-quest": "Orient",
  "pandora-heart-8-5": "Pandora Hearts",
  "pokemon-la-grande-aventure": "Pocket Monsters Special",
  "pokemon-zoroark-le-maitre-des-illusion": "Pokemon Zoroark Master of Illusions",
  "red-eyes-sword-akame-ga-kill": "Akame ga Kill!",
  "red-eyes-sword-akame-ga-kill-zero": "Akame ga Kill! Zero",
  "saga-of-tany-the-evil-youjo-senki": "Youjo Senki",
  "saint-seiya-the-lost-canvas-chronicles": "Saint Seiya: The Lost Canvas - Meiou Shinwa Gaiden",
  terraformars: "Terra Formars",
  "the-ancient-magus-bride-supplement-2": "The Ancient Magus' Bride: Collected Fragments",
  "the-unwanted-unded-adventurer": "Nozomanu Fushi no Boukensha",
  uqholder: "UQ Holder",
  "why-nobody-remember-my-world": "Naze Boku no Sekai wo Daremo Oboeteinai no ka",
  "yuna-de-la-pension-yuragi": "Yuragi-sou no Yuuna-san",
  "yusei-no-last-boss": "Yasei no Last Boss ga Arawareta!",
};

type Correspondance = {
  titreLocal: string;
  recherche: string;
  id: number;
  titre: string;
  titreFr: string | null;
  titreVo: string | null;
  auteur: string;
  genres: string[];
  themes: string[];
  cible: string | null;
  alias: string[];
  volumesJaponais: number | null;
  urlCanonique: string | null;
  score: number;
  exact: boolean;
  liens: LienMangaBaka[];
  autresCandidats: string[];
};

type Manifeste = Record<string, Correspondance | null>;

const dernierAppel = new Map<string, number>();

async function dormir(millisecondes: number) {
  await new Promise((suite) => setTimeout(suite, millisecondes));
}

async function patienter(file: string, parMinute: number) {
  const minimum = 60_000 / parMinute;
  const ecart = Date.now() - (dernierAppel.get(file) ?? 0);
  if (ecart < minimum) {
    await dormir(minimum - ecart);
  }
  dernierAppel.set(file, Date.now());
}

function scoreDeConfiance(etalon: string, candidat: SerieMangaBaka): number {
  const cible = normaliserAlias(etalon);
  const noms = candidat.titres
    .map((titre) => normaliserAlias(titre.titre))
    .filter((nom) => nom !== "");
  return Math.max(0, ...noms.map((nom) => similarite(cible, nom)));
}

function correspondanceExacte(etalon: string, candidat: SerieMangaBaka): boolean {
  const cible = normaliserAlias(etalon);
  return candidat.titres.some((titre) => normaliserAlias(titre.titre) === cible);
}

function meilleur(etalon: string, candidats: SerieMangaBaka[]): SerieMangaBaka | null {
  const classes = [...candidats].sort(
    (gauche, droite) => scoreDeConfiance(etalon, droite) - scoreDeConfiance(etalon, gauche),
  );
  return classes[0] ?? null;
}

function charger(): Manifeste {
  return existsSync(MANIFESTE) ? (JSON.parse(readFileSync(MANIFESTE, "utf-8")) as Manifeste) : {};
}

function enregistrer(manifeste: Manifeste) {
  const ordonne = Object.fromEntries(
    Object.entries(manifeste).sort(([gauche], [droite]) => gauche.localeCompare(droite)),
  );
  writeFileSync(MANIFESTE, `${JSON.stringify(ordonne, null, 2)}\n`);
}

async function resoudre(titreLocal: string, recherche: string): Promise<Correspondance | null> {
  await patienter("recherche", RECHERCHES_MANGABAKA_PAR_MINUTE);
  const trouvees = await rechercherSurMangaBaka(recherche);
  if (trouvees.indisponible) {
    throw new Error("MangaBaka est injoignable");
  }

  const retenu = meilleur(recherche, trouvees.valeur);
  if (!retenu) {
    return null;
  }

  await patienter("detail", DETAILS_MANGABAKA_PAR_MINUTE);
  const complete = await serieCompleteParId(retenu.id);
  const detaille = complete.valeur ? convertir(complete.valeur) : retenu;

  return enCorrespondance(
    titreLocal,
    recherche,
    detaille,
    complete.valeur ? liensDe(complete.valeur) : [],
    trouvees.valeur
      .filter((candidat) => candidat.id !== retenu.id)
      .map((candidat) => `${candidat.titre} (${candidat.id})`),
  );
}

function enCorrespondance(
  titreLocal: string,
  recherche: string,
  detaille: SerieMangaBaka,
  liens: LienMangaBaka[],
  autresCandidats: string[],
): Correspondance {
  return {
    titreLocal,
    recherche,
    id: detaille.id,
    titre: detaille.titre,
    titreFr: detaille.titreFr,
    titreVo: detaille.titreVo,
    auteur: detaille.auteur,
    genres: detaille.genres,
    themes: detaille.themes,
    cible: detaille.cible,
    alias: detaille.alias,
    volumesJaponais: detaille.volumesJaponais,
    urlCanonique: detaille.urlCanonique,
    score: Number(scoreDeConfiance(recherche, detaille).toFixed(3)),
    exact: correspondanceExacte(recherche, detaille),
    liens,
    autresCandidats,
  };
}

async function recalculer(manifeste: Manifeste): Promise<void> {
  const entrees = Object.entries(manifeste).filter(
    (entree): entree is [string, Correspondance] => entree[1] !== null,
  );
  let rang = 0;

  for (const [slug, avant] of entrees) {
    rang += 1;
    await patienter("detail", DETAILS_MANGABAKA_PAR_MINUTE);
    const complete = await serieCompleteParId(avant.id);
    if (!complete.valeur) {
      console.log(`[${rang}/${entrees.length}] ${slug} — injoignable, entree conservee`);
      continue;
    }

    const detaille = convertir(complete.valeur);
    manifeste[slug] = enCorrespondance(
      avant.titreLocal,
      avant.recherche,
      detaille,
      liensDe(complete.valeur),
      avant.autresCandidats,
    );
    enregistrer(manifeste);

    const genres = detaille.genres.filter((genre) => !avant.genres.includes(genre));
    const themes = detaille.themes.filter((theme) => !avant.themes.includes(theme));
    console.log(
      `[${rang}/${entrees.length}] ${slug} — ${detaille.genres.length} genres${genres.length ? ` (+${genres.join(", ")})` : ""}, ${detaille.themes.length} themes${themes.length ? ` (+${themes.join(", ")})` : ""}`,
    );
  }
}

async function main() {
  if (process.argv.includes(RECALCULER)) {
    const manifeste = charger();
    if (Object.keys(manifeste).length === 0) {
      throw new Error(`${MANIFESTE} est vide : rien a recalculer`);
    }
    await recalculer(manifeste);
    return;
  }

  const series = await prisma.serie.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, titre: true },
  });

  const manifeste = charger();
  const introuvables: string[] = [];
  const aRelire: string[] = [];
  let rang = 0;

  for (const serie of series) {
    rang += 1;
    if (ABSENTES_DE_MANGABAKA.has(serie.slug)) {
      manifeste[serie.slug] = null;
    } else if (!(serie.slug in manifeste)) {
      const recherche = RECHERCHES_MANUELLES[serie.slug] ?? serie.titre;
      try {
        manifeste[serie.slug] = await resoudre(serie.titre, recherche);
        enregistrer(manifeste);
      } catch (erreur) {
        console.log(
          `[${rang}/${series.length}] ${serie.slug} — ${erreur instanceof Error ? erreur.message : String(erreur)}`,
        );
        continue;
      }
    }

    const correspondance = manifeste[serie.slug];
    if (!correspondance) {
      introuvables.push(serie.slug);
      console.log(`[${rang}/${series.length}] ${serie.slug} — aucun resultat`);
      continue;
    }

    const marque = correspondance.exact ? "exact" : `score ${correspondance.score}`;
    console.log(
      `[${rang}/${series.length}] ${serie.slug} — ${correspondance.titre} (${marque}, ${correspondance.alias.length} alias, ${correspondance.genres.length} genres)`,
    );
    if (!correspondance.exact && correspondance.score < SCORE_A_RELIRE) {
      aRelire.push(`${serie.slug} → ${correspondance.titre} (${correspondance.score})`);
    }
  }

  const trouvees = Object.values(manifeste).filter((valeur) => valeur !== null);
  const exactes = trouvees.filter((valeur) => valeur?.exact).length;
  const alias = trouvees.reduce((somme, valeur) => somme + (valeur?.alias.length ?? 0), 0);
  const avecCible = trouvees.filter((valeur) => valeur?.cible !== null).length;
  const liens = trouvees.reduce((somme, valeur) => somme + (valeur?.liens.length ?? 0), 0);

  console.log();
  console.log(`Series interrogees   : ${series.length}`);
  console.log(`Correspondances      : ${trouvees.length}, dont ${exactes} exactes`);
  console.log(`Alias collectes      : ${alias}`);
  console.log(`Cible deduite        : ${avecCible} / ${trouvees.length}`);
  console.log(`Liens candidats      : ${liens}`);
  console.log(`Manifeste            : ${MANIFESTE}`);
  if (introuvables.length > 0) {
    console.log(`\nsans resultat (${introuvables.length}) :\n  ${introuvables.join("\n  ")}`);
  }
  if (aRelire.length > 0) {
    console.log(`\nappariement non exact, a relire (${aRelire.length}) :\n  ${aRelire.join("\n  ")}`);
  }
  console.log();
  console.log("Relire le manifeste avant d'ecrire en base.");
}

main().finally(() => prisma.$disconnect());
