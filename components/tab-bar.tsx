"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BooksFill, CalendarBlank, PlusCircle, PuzzlePiece } from "@/components/icons";
import { TITRE_AJOUTER, TITRE_MANQUANTS, TITRE_PLANNING } from "@/lib/constants";

const ONGLETS = [
  { href: "/", libelle: "Collection", Icone: BooksFill },
  { href: "/manquants", libelle: TITRE_MANQUANTS, Icone: PuzzlePiece },
  { href: "/planning", libelle: TITRE_PLANNING, Icone: CalendarBlank },
  { href: "/ajouter", libelle: TITRE_AJOUTER, Icone: PlusCircle },
] as const;

export function TabBar({ lectureSeule }: { lectureSeule: boolean }) {
  const chemin = usePathname();
  const onglets = lectureSeule ? ONGLETS.filter((o) => o.href !== "/ajouter") : ONGLETS;

  return (
    <nav className="bg-surface border-divider sticky bottom-0 flex border-t pt-[8px] pb-[calc(18px+env(safe-area-inset-bottom))]">
      {onglets.map(({ href, libelle, Icone }) => {
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
