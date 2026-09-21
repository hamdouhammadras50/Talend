import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState, Badge } from "@/components/StatCard";
import { buttonClasses, formatDate, formatMoney } from "@/lib/utils";

export default async function SalesPage() {
  const sales = await db.sale.findMany({
    orderBy: { date: "desc" },
    include: { client: true, warehouse: true, lines: true },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Ventes"
        description="Ventes en gros et au détail depuis les entrepôts"
        action={
          <Link href="/sales/new" className={buttonClasses("primary")}>
            + Nouvelle vente
          </Link>
        }
      />

      <Card className="overflow-x-auto">
        {sales.length === 0 ? (
          <EmptyState message="Aucune vente enregistrée pour le moment." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Entrepôt</th>
                <th className="px-4 py-3">Lignes</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/sales/${s.id}`} className="font-medium text-amber-700 hover:underline">
                      {s.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(s.date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.saleType === "GROS" ? "info" : "default"}>
                      {s.saleType === "GROS" ? "Gros" : "Détail"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.client?.name ?? "Client de passage"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.warehouse.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.lines.length}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{formatMoney(s.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
