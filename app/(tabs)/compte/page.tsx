import Link from "next/link";
import { CLASSE_BOUTON_DISCRET, CLASSE_BOUTON_SOUS_PAGE } from "@/components/champ";
import { CaretRight } from "@/components/icons";
import { seDeconnecter } from "@/lib/auth-actions";
import { chargerCompteCourant } from "@/lib/compte";
import {
  CHEMIN_COMPTE_IDENTITE,
  CHEMIN_COMPTE_MOT_DE_PASSE,
  LIBELLE_CHANGER_MOT_DE_PASSE,
  LIBELLE_DECONNEXION,
  LIBELLE_EMAIL,
  LIBELLE_IDENTIFIANT,
  LIBELLE_MODIFIER_IDENTITE,
  LIBELLE_NOM_AFFICHE,
  LIBELLE_ROLE_PROPRIETAIRE,
  TITRE_COMPTE,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Page() {
  const compte = await chargerCompteCourant();

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-[12px] px-[18px] pt-[22px] pb-[16px]">
        <h1 className="text-text text-[22px] font-semibold">{TITRE_COMPTE}</h1>
        {compte.proprietaire ? (
          <span className="text-[12px] text-neutral-500">{LIBELLE_ROLE_PROPRIETAIRE}</span>
        ) : null}
      </header>

      <div className="flex flex-col gap-[22px] px-[18px] pb-[18px]">
        <section className="border-divider flex flex-col border-t pt-[12px] text-[12px]">
          <Ligne cle={LIBELLE_IDENTIFIANT} valeur={compte.identifiant} />
          <Ligne cle={LIBELLE_EMAIL} valeur={compte.email} />
          <Ligne cle={LIBELLE_NOM_AFFICHE} valeur={compte.nom} />
        </section>

        <div className="flex flex-col gap-[10px]">
          <Link href={CHEMIN_COMPTE_IDENTITE} className={CLASSE_BOUTON_SOUS_PAGE}>
            {LIBELLE_MODIFIER_IDENTITE}
            <CaretRight className="size-[12px]" />
          </Link>
          <Link href={CHEMIN_COMPTE_MOT_DE_PASSE} className={CLASSE_BOUTON_SOUS_PAGE}>
            {LIBELLE_CHANGER_MOT_DE_PASSE}
            <CaretRight className="size-[12px]" />
          </Link>
        </div>

        <form action={seDeconnecter}>
          <button type="submit" className={CLASSE_BOUTON_DISCRET}>
            {LIBELLE_DECONNEXION}
          </button>
        </form>
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
      <span className="truncate text-right text-neutral-300">{valeur}</span>
    </div>
  );
}
