"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BooksFill, PlusCircle, PuzzlePiece } from "@/components/icons";
import { TITRE_AJOUTER, TITRE_MANQUANTS } from "@/lib/constants";

const ONGLETS = [
  { href: "/", libelle: "Collection", Icone: BooksFill },
  { href: "/manquants", libelle: TITRE_MANQUANTS, Icone: PuzzlePiece },
  { href: "/ajouter", libelle: TITRE_AJOUTER, Icone: PlusCircle },
] as const;

export function TabBar() {
  const chemin = usePathname();

  return (
    <nav className="bg-surface border-divider sticky bottom-0 flex border-t pt-[8px] pb-[18px]">
      {ONGLETS.map(({ href, libelle, Icone }) => {
        const actif = href === "/" ? chemin === "/" : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-[3px] ${
              actif ? "text-accent" : "text-neutral-600"
            }`}
          >
            <Icone className="size-[20px]" />
            <span className="text-[10px]">{libelle}</span>
          </Link>
        );
      })}
    </nav>
  );
}
