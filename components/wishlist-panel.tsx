import { WishlistRow } from "@/components/wishlist-row";
import { LIBELLE_AUCUN_RESULTAT, LIBELLE_WISHLIST_VIDE } from "@/lib/constants";
import type { LigneWishList, WishList } from "@/lib/domain";

type WishlistPanelProps = {
  wishList: WishList;
  lignes: LigneWishList[];
};

export function WishlistPanel({ wishList, lignes }: WishlistPanelProps) {
  const vide = wishList.lignes.length === 0;

  return (
    <>
      {vide ? (
        <p className="py-[24px] text-[13px]/[1.6] text-neutral-600">{LIBELLE_WISHLIST_VIDE}</p>
      ) : null}

      {!vide && lignes.length === 0 ? (
        <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_AUCUN_RESULTAT}</p>
      ) : null}

      {lignes.length > 0 ? (
        <ul className="flex flex-col">
          {lignes.map((ligne) => (
            <WishlistRow key={ligne.slug} ligne={ligne} />
          ))}
        </ul>
      ) : null}
    </>
  );
}
