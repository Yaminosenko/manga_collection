import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [editions, tomes, possedes] = await Promise.all([
    prisma.edition.count(),
    prisma.volume.count(),
    prisma.possession.count({ where: { possede: true } }),
  ]);

  return (
    <main className="p-6">
      <h1 className="text-xl text-text">Collection</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {editions} éditions · {possedes} tomes possédés sur {tomes} parus
      </p>
    </main>
  );
}
