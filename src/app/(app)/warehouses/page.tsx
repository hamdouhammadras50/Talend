import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/StatCard";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { buttonClasses, formatLiters } from "@/lib/utils";
import { deleteWarehouse } from "./actions";

export default async function WarehousesPage({
  searchParams,
}: PageProps<"/warehouses">) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;

  const warehouses = await db.warehouse.findMany({
    orderBy: { name: "asc" },
    include: { stockLots: true },
  });

  return (
    <div>
      <PageHeader
        title="Entrepôts"
        description="Points de stockage de l'huile"
        action={
          <Link href="/warehouses/new" className={buttonClasses("primary")}>
            + Nouvel entrepôt
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        {warehouses.length === 0 ? (
          <EmptyState message="Aucun entrepôt. Créez votre premier point de stockage." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Localisation</th>
                <th className="px-4 py-3">Stock total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {warehouses.map((w) => {
                const stock = w.stockLots.reduce((sum, lot) => sum + lot.quantityLiters, 0);
                return (
                  <tr key={w.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{w.name}</td>
                    <td className="px-4 py-3 text-slate-600">{w.location || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatLiters(stock)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/warehouses/${w.id}/edit`} className={buttonClasses("secondary")}>
                          Modifier
                        </Link>
                        <form action={deleteWarehouse}>
                          <input type="hidden" name="id" value={w.id} />
                          <ConfirmSubmitButton confirmMessage={`Supprimer l'entrepôt "${w.name}" ?`}>
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
