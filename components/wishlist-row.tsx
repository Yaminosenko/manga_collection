import Link from "next/link";
import { Cover } from "@/components/cover";
import { CaretRight } from "@/components/icons";
import type { LigneWishList } from "@/lib/domain";

const PLACEHOLDER_WISHLIST = "p-[6px] text-[12px] text-neutral-700";

function sousTitre(ligne: LigneWishList): string {
  return ligne.editeur ? `${ligne.nom} · ${ligne.editeur}` : ligne.nom;
}

export function WishlistRow({ ligne }: { ligne: LigneWishList }) {
  return (
    <li className="border-row-divider border-b">
      <Link
        href={`/edition/${ligne.slug}`}
        className="flex items-center gap-[14px] py-[9px] transition-colors hover:bg-text/2"
      >
        <div className="shadow-edge h-[120px] w-[84px] flex-none overflow-hidden rounded-cover">
          <Cover
            couvertureUrl={ligne.couvertureUrl}
            numero={null}
            titre={ligne.titre}
            placeholderClassName={PLACEHOLDER_WISHLIST}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <span className="titre-serie truncate text-[14px] font-medium text-text">
            {ligne.titre}
          </span>
          <span className="truncate text-[11.5px] text-neutral-600">{sousTitre(ligne)}</span>
          <span className="mt-[2px] text-[11.5px] font-medium text-neutral-500">
            0 / {ligne.tomesParus}
          </span>
        </div>

        <CaretRight className="size-[14px] flex-none text-neutral-600" />
      </Link>
    </li>
  );
}
