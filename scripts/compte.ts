import "dotenv/config";
import { createInterface } from "node:readline";
import { prisma } from "../lib/prisma";
import { hacherMotDePasse } from "../lib/auth";
import {
  emailValide,
  identifiantValide,
  motDePasseAssezLong,
  normaliserEmail,
  normaliserIdentifiant,
} from "../lib/domain";
import {
  LIBELLE_EMAIL_INVALIDE,
  LIBELLE_IDENTIFIANT_INVALIDE,
  LIBELLE_MOT_DE_PASSE_COURT,
  LIBELLE_PROPRIETAIRE_ABSENT,
} from "../lib/constants";

const LISTER = "--lister";
const PROPRIETAIRE = "--proprietaire";
const REINITIALISER = "--reinitialiser";
const OPTION_IDENTIFIANT = "--identifiant";
const OPTION_EMAIL = "--email";
const OPTION_MOT_DE_PASSE = "--mot-de-passe";

const USAGE = `Usage :
  npm run compte -- --lister
  npm run compte -- --proprietaire --identifiant <pseudo> [--email <adresse>]
  npm run compte -- --reinitialiser <pseudo>

Le mot de passe est demandé sans écho. --mot-de-passe <valeur> le passe en argument,
au prix d'une trace dans l'historique du shell.
LOCAL_DATABASE_URL en préfixe de commande vise un Postgres local au lieu de Neon.`;

function valeurOption(arguments_: string[], nom: string): string | null {
  const index = arguments_.indexOf(nom);
  if (index === -1 || index + 1 >= arguments_.length) {
    return null;
  }
  return arguments_[index + 1];
}

async function demanderMotDePasse(invite: string): Promise<string> {
  const lecture = createInterface({ input: process.stdin, output: process.stdout });
  const sortie = process.stdout as NodeJS.WriteStream & { muted?: boolean };
  const ecrire = sortie.write.bind(sortie);

  process.stdout.write(invite);
  sortie.write = ((donnee: string | Uint8Array, ...reste: unknown[]) => {
    if (sortie.muted && typeof donnee === "string" && !donnee.includes("\n")) {
      return true;
    }
    return (ecrire as (...arguments_: unknown[]) => boolean)(donnee, ...reste);
  }) as typeof sortie.write;
  sortie.muted = true;

  const saisie = await new Promise<string>((resoudre) => {
    lecture.question("", (reponse) => resoudre(reponse));
  });

  sortie.muted = false;
  sortie.write = ecrire;
  process.stdout.write("\n");
  lecture.close();
  return saisie;
}

async function motDePasseDemande(arguments_: string[]): Promise<string> {
  const fourni = valeurOption(arguments_, OPTION_MOT_DE_PASSE);
  if (fourni === null && !process.stdin.isTTY) {
    throw new Error(
      `Pas de terminal pour saisir le mot de passe : passer ${OPTION_MOT_DE_PASSE} <valeur>.`,
    );
  }
  const saisi = fourni ?? (await demanderMotDePasse("Mot de passe : "));

  if (!motDePasseAssezLong(saisi)) {
    throw new Error(LIBELLE_MOT_DE_PASSE_COURT);
  }

  if (!fourni) {
    const confirmation = await demanderMotDePasse("Confirmer : ");
    if (confirmation !== saisi) {
      throw new Error("Les deux saisies ne correspondent pas.");
    }
  }

  return saisi;
}

async function compteursDe(utilisateurId: string): Promise<string> {
  const [suivis, possessions, possedes] = await Promise.all([
    prisma.suiviEdition.count({ where: { utilisateurId } }),
    prisma.possession.count({ where: { utilisateurId } }),
    prisma.possession.count({ where: { utilisateurId, possede: true } }),
  ]);
  return `${suivis} éditions suivies · ${possessions} possessions dont ${possedes} possédées`;
}

async function lister(): Promise<void> {
  const utilisateurs = await prisma.utilisateur.findMany({ orderBy: { creeLe: "asc" } });

  for (const utilisateur of utilisateurs) {
    const nom = utilisateur.identifiant ?? "(sans identifiant)";
    const acces = utilisateur.motDePasseHash ? "mot de passe posé" : "SANS MOT DE PASSE";
    console.log(
      `${nom} · ${utilisateur.role} · ${utilisateur.email ?? "(sans email)"} · ${acces}`,
    );
    console.log(`  ${await compteursDe(utilisateur.id)}`);
  }

  console.log(`\n${utilisateurs.length} compte(s).`);
}

async function poserSurLeProprietaire(arguments_: string[]): Promise<void> {
  const identifiant = normaliserIdentifiant(valeurOption(arguments_, OPTION_IDENTIFIANT) ?? "");
  if (!identifiantValide(identifiant)) {
    throw new Error(LIBELLE_IDENTIFIANT_INVALIDE);
  }

  const emailBrut = valeurOption(arguments_, OPTION_EMAIL);
  const email = emailBrut ? normaliserEmail(emailBrut) : null;
  if (email !== null && !emailValide(email)) {
    throw new Error(LIBELLE_EMAIL_INVALIDE);
  }

  const proprietaires = await prisma.utilisateur.findMany({
    where: { role: "PROPRIETAIRE" },
    orderBy: { creeLe: "asc" },
    select: { id: true, identifiant: true },
  });

  if (proprietaires.length === 0) {
    throw new Error(LIBELLE_PROPRIETAIRE_ABSENT);
  }
  if (proprietaires.length > 1) {
    throw new Error(
      `${proprietaires.length} comptes PROPRIETAIRE en base : refus d'en choisir un.`,
    );
  }

  const proprietaire = proprietaires[0];
  const motDePasse = await motDePasseDemande(arguments_);

  await prisma.utilisateur.update({
    where: { id: proprietaire.id },
    data: {
      identifiant,
      motDePasseHash: await hacherMotDePasse(motDePasse),
      versionJeton: { increment: 1 },
      ...(email === null ? {} : { email }),
    },
  });

  console.log(`Propriétaire ${proprietaire.id} : identifiant « ${identifiant} » posé.`);
  console.log(await compteursDe(proprietaire.id));
}

async function reinitialiser(arguments_: string[]): Promise<void> {
  const identifiant = normaliserIdentifiant(valeurOption(arguments_, REINITIALISER) ?? "");
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { identifiant },
    select: { id: true },
  });

  if (!utilisateur) {
    throw new Error(`Aucun compte pour l'identifiant « ${identifiant} ».`);
  }

  const motDePasse = await motDePasseDemande(arguments_);

  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: {
      motDePasseHash: await hacherMotDePasse(motDePasse),
      versionJeton: { increment: 1 },
    },
  });

  console.log(`Mot de passe réinitialisé pour « ${identifiant} », sessions coupées.`);
  console.log(await compteursDe(utilisateur.id));
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const cible = urlDeLaCible();

  if (arguments_.includes(LISTER)) {
    console.log(`Cible : ${cible}\n`);
    await lister();
    return;
  }

  if (arguments_.includes(PROPRIETAIRE)) {
    console.log(`Cible : ${cible}`);
    await poserSurLeProprietaire(arguments_);
    return;
  }

  if (arguments_.includes(REINITIALISER)) {
    console.log(`Cible : ${cible}`);
    await reinitialiser(arguments_);
    return;
  }

  console.log(USAGE);
}

function urlDeLaCible(): string {
  return process.env["LOCAL_DATABASE_URL"]
    ? "Postgres local (LOCAL_DATABASE_URL)"
    : "Neon (DATABASE_URL)";
}

main()
  .catch((erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
