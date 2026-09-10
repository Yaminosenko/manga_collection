import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(process.cwd(), "data", "mangabaka.json");
const MANIFESTE = join(process.cwd(), "data", "relations.json");

const LIENS_MANUELS: { de: string; vers: string; type: string }[] = [
  { de: "pandora-heart", vers: "pandora-heart-8-5", type: "GUIDE" },
  { de: "pandora-heart-8-5", vers: "pandora-heart", type: "SERIE_MERE" },
  { de: "the-ancient-magus-bride", vers: "the-ancient-magus-bride-supplement-2", type: "GUIDE" },
  { de: "the-ancient-magus-bride-supplement-2", vers: "the-ancient-magus-bride", type: "SERIE_MERE" },
];

type Correspondance = {
  id: number;
  titre: string;
  exact: boolean;
  liens: { id: number; type: string }[];
};

type Manifeste = Record<string, Correspondance | null>;
type Lien = { slug: string; type: string; titre: string | null };

function main() {
  if (!existsSync(SOURCE)) {
    console.log(`${SOURCE} absent : lancer mangabaka:fetch d'abord`);
    return;
  }

  const mangabaka = JSON.parse(readFileSync(SOURCE, "utf-8")) as Manifeste;

  const slugsParId = new Map<number, string[]>();
  const titresParId = new Map<number, string>();
  for (const [slug, entree] of Object.entries(mangabaka)) {
    if (!entree || !entree.exact) continue;
    slugsParId.set(entree.id, [...(slugsParId.get(entree.id) ?? []), slug]);
    titresParId.set(entree.id, entree.titre);
  }

  const liensParSlug: Record<string, Lien[]> = {};
  let candidats = 0;

  for (const [slug, entree] of Object.entries(mangabaka)) {
    if (!entree || !entree.exact) continue;

    const liens: Lien[] = [];
    for (const lien of entree.liens) {
      candidats += 1;
      for (const voisin of slugsParId.get(lien.id) ?? []) {
        if (voisin === slug) continue;
        if (liens.some((deja) => deja.slug === voisin)) continue;
        liens.push({ slug: voisin, type: lien.type, titre: titresParId.get(lien.id) ?? null });
      }
    }

    if (liens.length > 0) {
      liensParSlug[slug] = liens;
    }
  }

  for (const manuel of LIENS_MANUELS) {
    if (!(manuel.de in mangabaka) || !(manuel.vers in mangabaka)) {
      console.log(`lien manuel ignore, slug inconnu : ${manuel.de} -> ${manuel.vers}`);
      continue;
    }
    const liens = liensParSlug[manuel.de] ?? [];
    if (liens.some((lien) => lien.slug === manuel.vers)) continue;
    liens.push({ slug: manuel.vers, type: manuel.type, titre: null });
    liensParSlug[manuel.de] = liens;
  }

  const ordonne = Object.fromEntries(
    Object.entries(liensParSlug).sort(([gauche], [droite]) => gauche.localeCompare(droite)),
  );
  writeFileSync(MANIFESTE, `${JSON.stringify(ordonne, null, 2)}\n`);

  const total = Object.values(ordonne).reduce((somme, liens) => somme + liens.length, 0);
  console.log(`Series appariees     : ${slugsParId.size}`);
  console.log(`Liens MangaBaka lus  : ${candidats}`);
  console.log(`Series avec liens    : ${Object.keys(ordonne).length}`);
  console.log(`Liens retenus        : ${total}`);
  console.log(`Manifeste            : ${MANIFESTE}`);
  console.log();
  console.log("Relire le manifeste avant d'ecrire en base.");
}

main();
