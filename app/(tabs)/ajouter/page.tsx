import { notFound } from "next/navigation";
import { AddSeries } from "@/components/add-series";
import { estProprietaire } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await estProprietaire())) {
    notFound();
  }

  return <AddSeries />;
}
