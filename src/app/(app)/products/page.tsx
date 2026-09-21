import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState, Badge } from "@/components/StatCard";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { buttonClasses, formatLiters, formatMoney } from "@/lib/utils";
import { deleteProduct } from "./actions";

export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;

  const products = await db.product.findMany({
    orderBy: { name: "asc" },
    include: { stockLots: true },
  });

  return (
    <div>
      <PageHeader
        title="Produits"
        description="Types d'huile gérés dans le stock"
        action={
          <Link href="/products/new" className={buttonClasses("primary")}>
            + Nouveau produit
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        {products.length === 0 ? (
          <EmptyState message="Aucun produit. Créez votre premier produit d'huile." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Conteneur</th>
                <th className="px-4 py-3">Prix gros</th>
                <th className="px-4 py-3">Prix détail</th>
                <th className="px-4 py-3">Stock actuel</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const stock = p.stockLots.reduce((sum, lot) => sum + lot.quantityLiters, 0);
                const low = p.minStockLiters > 0 && stock < p.minStockLiters;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{formatLiters(p.litersPerContainer)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(p.wholesalePrice)}/L</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(p.retailPrice)}/L</td>
                    <td className="px-4 py-3">
                      <span className={low ? "font-medium text-amber-700" : "text-slate-700"}>
                        {formatLiters(stock)}
                      </span>
                      {low ? <Badge tone="warning">bas</Badge> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.active ? "success" : "default"}>
                        {p.active ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/products/${p.id}/edit`}
                          className={buttonClasses("secondary")}
                        >
                          Modifier
                        </Link>
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Supprimer le produit "${p.name}" ?`}
                          >
                            Supprimer
                          </ConfirmSubmitButton>
                        </form>
                      </div>
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
