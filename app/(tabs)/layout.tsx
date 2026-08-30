import { TabBar } from "@/components/tab-bar";
import { estProprietaire } from "@/lib/guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const proprietaire = await estProprietaire();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <TabBar lectureSeule={!proprietaire} />
    </div>
  );
}
