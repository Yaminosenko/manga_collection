import { WishlistRow } from "@/components/wishlist-row";
import { chargerWishList } from "@/lib/editions";
import {
  LIBELLE_WISHLIST_COMPTEUR_PLURIEL,
  LIBELLE_WISHLIST_COMPTEUR_SINGULIER,
  LIBELLE_WISHLIST_VIDE,
  TITRE_WISHLIST,
} from "@/lib/constants";
import { formaterNombre } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { lignes } = await chargerWishList();

  const compteur =
    lignes.length === 1
      ? LIBELLE_WISHLIST_COMPTEUR_SINGULIER
      : LIBELLE_WISHLIST_COMPTEUR_PLURIEL;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-[12px] px-[18px] pt-[14px] pb-[10px]">
        <h1 className="text-[20px] font-medium text-text">{TITRE_WISHLIST}</h1>
        {lignes.length > 0 ? (
          <span className="text-[11.5px] whitespace-nowrap text-neutral-500">
            {formaterNombre(lignes.length)} {compteur}
          </span>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col px-[18px] pb-[18px]">
        {lignes.length === 0 ? (
          <p className="py-[24px] text-[13px]/[1.6] text-neutral-600">{LIBELLE_WISHLIST_VIDE}</p>
        ) : (
          <ul className="flex flex-col">
            {lignes.map((ligne) => (
              <WishlistRow key={ligne.slug} ligne={ligne} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
