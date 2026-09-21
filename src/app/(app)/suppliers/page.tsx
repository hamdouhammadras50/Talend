import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/StatCard";
import { buttonClasses } from "@/lib/utils";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteSupplier } from "./actions";

export default async function SuppliersPage({
  searchParams,
}: PageProps<"/suppliers">) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;

  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        description="Fournisseurs auprès desquels l'huile est achetée"
        action={
          <Link href="/suppliers/new" className={buttonClasses("primary")}>
            + Nouveau fournisseur
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        {suppliers.length === 0 ? (
          <EmptyState message="Aucun fournisseur enregistré." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Adresse</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.address || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/suppliers/${s.id}/edit`} className={buttonClasses("secondary")}>
                        Modifier
                      </Link>
                      <form action={deleteSupplier}>
                        <input type="hidden" name="id" value={s.id} />
                        <ConfirmSubmitButton confirmMessage={`Supprimer le fournisseur "${s.name}" ?`}>
                          Supprimer
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
