import Link from "next/link";
import { db } from "@/lib/db";
import { StatCard, PageHeader, Card, EmptyState, Badge } from "@/components/StatCard";
import { formatDateTime, formatLiters, formatMoney } from "@/lib/utils";

const MOVEMENT_LABELS: Record<string, { label: string; tone: "success" | "danger" | "info" }> = {
  ENTREE: { label: "Entrée", tone: "success" },
  SORTIE: { label: "Sortie", tone: "danger" },
  AJUSTEMENT: { label: "Ajustement", tone: "info" },
};

export default async function DashboardPage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    stockLots,
    products,
    salesThisMonth,
    purchasesThisMonth,
    recentMovements,
  ] = await Promise.all([
    db.stockLot.findMany({ include: { product: true, warehouse: true } }),
    db.product.findMany({ where: { active: true } }),
    db.sale.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    db.purchase.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { totalCost: true },
      _count: true,
    }),
    db.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { product: true, warehouse: true },
    }),
  ]);

  const totalStockLiters = stockLots.reduce((sum, lot) => sum + lot.quantityLiters, 0);

  const stockByProduct = new Map<string, number>();
  for (const lot of stockLots) {
    stockByProduct.set(lot.productId, (stockByProduct.get(lot.productId) ?? 0) + lot.quantityLiters);
  }
  const lowStockProducts = products.filter(
    (p) => p.minStockLiters > 0 && (stockByProduct.get(p.id) ?? 0) < p.minStockLiters
  );

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble du stock d'huile et de l'activité récente"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stock total" value={formatLiters(totalStockLiters)} hint="Tous produits, tous entrepôts" />
        <StatCard
          label="Ventes ce mois-ci"
          value={formatMoney(salesThisMonth._sum.totalAmount ?? 0)}
          hint={`${salesThisMonth._count} vente(s)`}
        />
        <StatCard
          label="Achats ce mois-ci"
          value={formatMoney(purchasesThisMonth._sum.totalCost ?? 0)}
          hint={`${purchasesThisMonth._count} achat(s)`}
        />
        <StatCard
          label="Alertes stock bas"
          value={String(lowStockProducts.length)}
          tone={lowStockProducts.length > 0 ? "warning" : "success"}
          hint="Produits sous le seuil minimum"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
            Alertes de stock bas
          </div>
          {lowStockProducts.length === 0 ? (
            <EmptyState message="Aucune alerte, tous les stocks sont au-dessus du seuil minimum." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStockProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="text-amber-700">
                    {formatLiters(stockByProduct.get(p.id) ?? 0)} / seuil {formatLiters(p.minStockLiters)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="font-medium text-slate-900">Derniers mouvements</span>
            <Link href="/stock" className="text-sm text-amber-700 hover:underline">
              Voir le stock
            </Link>
          </div>
          {recentMovements.length === 0 ? (
            <EmptyState message="Aucun mouvement de stock enregistré." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentMovements.map((m) => {
                const info = MOVEMENT_LABELS[m.type];
                return (
                  <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-slate-800">{m.product.name}</div>
                      <div className="text-xs text-slate-500">
                        {m.warehouse.name} · {formatDateTime(m.createdAt)}
                        {m.reference ? ` · ${m.reference}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={info?.tone ?? "default"}>{info?.label ?? m.type}</Badge>
                      <span className={m.quantityLiters < 0 ? "text-red-600" : "text-emerald-700"}>
                        {m.quantityLiters > 0 ? "+" : ""}
                        {formatLiters(m.quantityLiters)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
