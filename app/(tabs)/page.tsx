import { CollectionSpace } from "@/components/collection-space";
import { chargerEspaceCollection } from "@/lib/editions";
import { PANNEAU_PAR_DEFAUT } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Page() {
  const espace = await chargerEspaceCollection();

  return (
    <main className="flex flex-1 flex-col">
      <CollectionSpace espace={espace} panneauInitial={PANNEAU_PAR_DEFAUT} />
    </main>
  );
}
