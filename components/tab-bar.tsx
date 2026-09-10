"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BooksFill, CalendarBlank, MagnifyingGlass } from "@/components/icons";
import {
  PANNEAUX,
  TITRE_COLLECTION,
  TITRE_PLANNING,
  TITRE_RECHERCHER,
} from "@/lib/constants";

const CHEMINS_ESPACE_COLLECTION: readonly string[] = PANNEAUX.map((panneau) => panneau.route);

const ONGLETS = [
  { href: "/", libelle: TITRE_COLLECTION, Icone: BooksFill },
  { href: "/planning", libelle: TITRE_PLANNING, Icone: CalendarBlank },
  { href: "/ajouter", libelle: TITRE_RECHERCHER, Icone: MagnifyingGlass },
] as const;

export function TabBar({ lectureSeule }: { lectureSeule: boolean }) {
  const chemin = usePathname();
  const onglets = lectureSeule ? ONGLETS.filter((o) => o.href !== "/ajouter") : ONGLETS;

  return (
    <nav className="bg-surface border-divider sticky bottom-0 flex border-t pt-[8px] pb-[calc(18px+env(safe-area-inset-bottom))]">
      {onglets.map(({ href, libelle, Icone }) => {
        const actif =
          href === "/" ? CHEMINS_ESPACE_COLLECTION.includes(chemin) : chemin.startsWith(href);
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
