import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { URL_ANILIST } from "../lib/constants";

const SOURCE = join(process.cwd(), "data", "anilist.json");
const MANIFESTE = join(process.cwd(), "data", "relations.json");
const REQUETES_PAR_MINUTE = 28;
const TENTATIVES_MAX = 4;
const ATTENTE_PAR_DEFAUT_SECONDES = 60;

const TYPES_RETENUS: Record<string, string> = {
  PREQUEL: "PREQUELLE",
  SEQUEL: "SUITE",
  SIDE_STORY: "HORS_SERIE",
  PARENT: "SERIE_MERE",
  SPIN_OFF: "SPIN_OFF",
  ALTERNATIVE: "AUTRE",
  OTHER: "AUTRE",
  SUMMARY: "AUTRE",
  COMPILATION: "AUTRE",
  CONTAINS: "AUTRE",
};

const IDENTIFIANTS_EMPRUNTES = new Set([
  "pandora-heart-8-5",
  "the-ancient-magus-bride-supplement-2",
]);

const RESOLUTIONS_DOUTEUSES = new Set(["mushoku-tensei", "mushoku-tensei-l-epee-d-iris"]);

const LIENS_MANUELS: { de: string; vers: string; type: string }[] = [
  { de: "pandora-heart", vers: "pandora-heart-8-5", type: "GUIDE" },
  { de: "pandora-heart-8-5", vers: "pandora-heart", type: "SERIE_MERE" },
  {
    de: "the-ancient-magus-bride",
    vers: "the-ancient-magus-bride-supplement-2",
    type: "GUIDE",
  },
  {
    de: "the-ancient-magus-bride-supplement-2",
    vers: "the-ancient-magus-bride",
    type: "SERIE_MERE",
  },
];

const REQUETE = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    relations {
      edges {
        relationType
        node { id type title { romaji } }
      }
    }
  }
}`;

type Arete = {
  relationType: string;
  node: { id: number; type: string; title: { romaji: string | null } };
};

type Lien = { slug: string; type: string; romaji: string | null };
type Manifeste = Record<string, Lien[]>;

let dernierAppel = 0;

async function dormir(millisecondes: number) {
  await new Promise((suite) => setTimeout(suite, millisecondes));
}

async function patienter() {
  const minimum = 60_000 / REQUETES_PAR_MINUTE;
  const ecart = Date.now() - dernierAppel;
  if (ecart < minimum) {
    await dormir(minimum - ecart);
  }
  dernierAppel = Date.now();
}

async function interroger(id: number): Promise<Arete[] | null> {
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative += 1) {
    await patienter();
    const reponse = await fetch(URL_ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: REQUETE, variables: { id } }),
    });

    if (reponse.status === 429) {
      const entete = Number(reponse.headers.get("retry-after"));
      const attente = Number.isFinite(entete) && entete > 0 ? entete : ATTENTE_PAR_DEFAUT_SECONDES;
      console.log(`  429, pause de ${attente} s`);
      await dormir(attente * 1000);
      continue;
    }
    if (!reponse.ok) {
      continue;
    }

    const charge = (await reponse.json()) as {
      data?: { Media?: { relations?: { edges?: Arete[] } } };
    };
    return charge.data?.Media?.relations?.edges ?? [];
  }
  return null;
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.log(`${SOURCE} absent : lancer anilist:fetch d'abord`);
    return;
  }

  const anilist = JSON.parse(readFileSync(SOURCE, "utf-8")) as Record<
    string,
    { id?: number; romaji?: string | null } | null
  >;

  const idParSlug = new Map<string, number>();
  const slugsParId = new Map<number, string[]>();
  for (const [slug, entree] of Object.entries(anilist)) {
    if (!entree?.id) continue;
    idParSlug.set(slug, entree.id);
    slugsParId.set(entree.id, [...(slugsParId.get(entree.id) ?? []), slug]);
  }

  const manifeste: Manifeste = {};
  const echecs: string[] = [];
  let rang = 0;

  const ecartees = new Set([...IDENTIFIANTS_EMPRUNTES, ...RESOLUTIONS_DOUTEUSES]);

  for (const [slug, id] of idParSlug) {
    rang += 1;
    if (ecartees.has(slug)) {
      console.log(`[${rang}/${idParSlug.size}] ${slug} — ecarte, identifiant AniList non fiable`);
      continue;
    }
    const aretes = await interroger(id);
    if (aretes === null) {
      echecs.push(slug);
      console.log(`[${rang}/${idParSlug.size}] ${slug} — echec`);
      continue;
    }

    const liens: Lien[] = [];
    for (const arete of aretes) {
      if (arete.node.type !== "MANGA") continue;
      const type = TYPES_RETENUS[arete.relationType];
      if (!type) continue;
      for (const voisin of slugsParId.get(arete.node.id) ?? []) {
        if (voisin === slug || ecartees.has(voisin)) continue;
        liens.push({ slug: voisin, type, romaji: arete.node.title.romaji });
      }
    }

    if (liens.length > 0) {
      manifeste[slug] = liens;
    }
    console.log(
      `[${rang}/${idParSlug.size}] ${slug} — ${liens.length ? liens.map((l) => `${l.type} ${l.slug}`).join(", ") : "aucun lien possede"}`,
    );
  }

  for (const manuel of LIENS_MANUELS) {
    if (!(manuel.de in anilist) || !(manuel.vers in anilist)) {
      console.log(`lien manuel ignore, slug inconnu : ${manuel.de} -> ${manuel.vers}`);
      continue;
    }
    const liens = manifeste[manuel.de] ?? [];
    if (liens.some((lien) => lien.slug === manuel.vers)) continue;
    liens.push({ slug: manuel.vers, type: manuel.type, romaji: null });
    manifeste[manuel.de] = liens;
  }

  const ordonne = Object.fromEntries(Object.entries(manifeste).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFESTE, `${JSON.stringify(ordonne, null, 2)}\n`);

  const total = Object.values(ordonne).reduce((somme, liens) => somme + liens.length, 0);
  console.log();
  console.log(`Series interrogees   : ${idParSlug.size}`);
  console.log(`Series avec liens    : ${Object.keys(ordonne).length}`);
  console.log(`Liens retenus        : ${total}`);
  if (echecs.length > 0) {
    console.log(`Echecs               : ${echecs.join(", ")}`);
  }
  console.log(`Manifeste            : ${MANIFESTE}`);
  console.log();
  console.log("Relire le manifeste avant d'ecrire en base.");
}

main();
