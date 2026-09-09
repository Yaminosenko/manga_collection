import { notFound } from "next/navigation";
import { SearchSeries } from "@/components/search-series";
import { estProprietaire } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await estProprietaire())) {
    notFound();
  }

  return <SearchSeries />;
}
