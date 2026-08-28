import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [editions, tomes, possedes, liste] = await Promise.all([
    prisma.edition.count(),
    prisma.volume.count(),
    prisma.possession.count({ where: { possede: true } }),
    prisma.edition.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true, nom: true, tomesParus: true, serie: { select: { titre: true } } },
    }),
  ]);

  return (
    <main className="flex min-h-dvh flex-col px-[18px] py-[14px]">
      <h1 className="text-[20px] font-medium text-text">Collection</h1>
      <p className="mt-[4px] text-[11.5px] text-neutral-500">
        {editions} éditions · {possedes} tomes possédés sur {tomes} parus
      </p>

      <ul className="mt-[14px] flex flex-col">
        {liste.map((edition) => (
          <li key={edition.slug}>
            <Link
              href={`/edition/${edition.slug}`}
              className="border-row-divider flex min-h-11 flex-col justify-center border-b py-[10px]"
            >
              <span className="truncate text-[14px] font-medium text-text">
                {edition.serie.titre}
              </span>
              <span className="truncate text-[11.5px] text-neutral-600">
                {edition.nom} · {edition.tomesParus} tomes parus
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
