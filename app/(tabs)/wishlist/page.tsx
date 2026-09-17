import { CollectionSpace } from "@/components/collection-space";
import { chargerEspaceCollection } from "@/lib/editions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const espace = await chargerEspaceCollection();

  return (
    <main className="espace-plein-ecran flex min-h-0 flex-1 flex-col">
      <CollectionSpace espace={espace} panneauInitial="wishlist" />
    </main>
  );
}
