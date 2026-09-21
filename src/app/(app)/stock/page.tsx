import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState, Badge } from "@/components/StatCard";
import { buttonClasses, formatLiters, formatNumber } from "@/lib/utils";

export default async function StockPage({
  searchParams,
}: PageProps<"/stock">) {
  const params = await searchParams;
  const warehouseId = typeof params?.warehouse === "string" ? params.warehouse : undefined;

  const [warehouses, lots] = await Promise.all([
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
    db.stockLot.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      include: { product: true, warehouse: true },
      orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Quantités disponibles par produit et par entrepôt"
        action={
          <Link href="/stock/adjust" className={buttonClasses("primary")}>
            + Ajustement de stock
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink label="Tous les entrepôts" href="/stock" active={!warehouseId} />
        {warehouses.map((w) => (
          <FilterLink
            key={w.id}
            label={w.name}
            href={`/stock?warehouse=${w.id}`}
            active={warehouseId === w.id}
          />
        ))}
      </div>

      <Card className="overflow-x-auto">
        {lots.length === 0 ? (
          <EmptyState message="Aucun stock enregistré pour le moment." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Entrepôt</th>
                <th className="px-4 py-3">Quantité</th>
                <th className="px-4 py-3">Conteneurs (approx.)</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.map((lot) => {
                const low =
                  lot.product.minStockLiters > 0 && lot.quantityLiters < lot.product.minStockLiters;
                const containers = lot.product.litersPerContainer
                  ? lot.quantityLiters / lot.product.litersPerContainer
                  : 0;
                return (
                  <tr key={lot.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{lot.product.name}</td>
                    <td className="px-4 py-3 text-slate-600">{lot.warehouse.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatLiters(lot.quantityLiters)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatNumber(containers)}</td>
                    <td className="px-4 py-3">
                      {low ? (
                        <Badge tone="warning">Stock bas</Badge>
                      ) : (
                        <Badge tone="success">OK</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
          : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {label}
    </Link>
  );
}
