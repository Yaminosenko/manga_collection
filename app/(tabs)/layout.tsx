import { InstallBanner } from "@/components/install-banner";
import { TabBar } from "@/components/tab-bar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="colonne-onglets flex flex-col">
      <InstallBanner />
      <div className="contenu-onglets flex flex-1 flex-col">{children}</div>
      <TabBar />
    </div>
  );
}
