import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { formatDate, formatDateTime, formatLiters, formatMoney, formatNumber } from "@/lib/utils";

export default async function PurchaseDetailPage({
  params,
}: PageProps<"/purchases/[id]">) {
  const { id } = await params;
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      warehouse: true,
      createdBy: true,
      lines: { include: { product: true } },
    },
  });
  if (!purchase) notFound();

  return (
    <div>
      <PageHeader
        title={`Achat ${purchase.reference}`}
        description={`Reçu le ${formatDate(purchase.date)} à ${purchase.warehouse.name}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Lignes de l&apos;achat</h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Produit</th>
                <th className="py-2">Conteneurs</th>
                <th className="py-2">Litres</th>
                <th className="py-2">Coût / L</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchase.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-2 font-medium text-slate-900">{line.product.name}</td>
                  <td className="py-2 text-slate-600">{formatNumber(line.quantityContainers)}</td>
                  <td className="py-2 text-slate-600">{formatLiters(line.quantityLiters)}</td>
                  <td className="py-2 text-slate-600">{formatMoney(line.unitCostPerLiter)}</td>
                  <td className="py-2 font-medium text-slate-800">{formatMoney(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-right text-base font-semibold text-slate-900">
            Total : {formatMoney(purchase.totalCost)}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Détails</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Fournisseur" value={purchase.supplier?.name ?? "—"} />
            <Row label="Entrepôt" value={purchase.warehouse.name} />
            <Row label="Enregistré par" value={purchase.createdBy?.name ?? "—"} />
            <Row label="Créé le" value={formatDateTime(purchase.createdAt)} />
            {purchase.notes ? <Row label="Notes" value={purchase.notes} /> : null}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}
