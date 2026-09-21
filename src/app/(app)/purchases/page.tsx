import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/StatCard";
import { buttonClasses, formatDate, formatMoney } from "@/lib/utils";

export default async function PurchasesPage() {
  const purchases = await db.purchase.findMany({
    orderBy: { date: "desc" },
    include: { supplier: true, warehouse: true, lines: true },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Achats"
        description="Réceptions de conteneurs d'huile dans les entrepôts"
        action={
          <Link href="/purchases/new" className={buttonClasses("primary")}>
            + Nouvel achat
          </Link>
        }
      />

      <Card className="overflow-x-auto">
        {purchases.length === 0 ? (
          <EmptyState message="Aucun achat enregistré pour le moment." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Fournisseur</th>
                <th className="px-4 py-3">Entrepôt</th>
                <th className="px-4 py-3">Lignes</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/purchases/${p.id}`} className="font-medium text-amber-700 hover:underline">
                      {p.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.warehouse.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.lines.length}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{formatMoney(p.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
