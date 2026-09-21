import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState, Badge } from "@/components/StatCard";
import { buttonClasses } from "@/lib/utils";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteClient } from "./actions";

export default async function ClientsPage({
  searchParams,
}: PageProps<"/clients">) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;

  const clients = await db.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Clients grossistes et détaillants"
        action={
          <Link href="/clients/new" className={buttonClasses("primary")}>
            + Nouveau client
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        {clients.length === 0 ? (
          <EmptyState message="Aucun client enregistré." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={c.type === "GROS" ? "info" : "default"}>
                      {c.type === "GROS" ? "Gros" : "Détail"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/clients/${c.id}/edit`} className={buttonClasses("secondary")}>
                        Modifier
                      </Link>
                      <form action={deleteClient}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmSubmitButton confirmMessage={`Supprimer le client "${c.name}" ?`}>
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
