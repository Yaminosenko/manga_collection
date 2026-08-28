import { CollectionList } from "@/components/collection-list";
import { chargerCollection } from "@/lib/editions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const collection = await chargerCollection();

  return (
    <main className="flex flex-1 flex-col">
      <CollectionList collection={collection} />
    </main>
  );
}
