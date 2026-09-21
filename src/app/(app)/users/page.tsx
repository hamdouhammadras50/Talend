import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/StatCard";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { buttonClasses, formatDate } from "@/lib/utils";
import { CreateUserForm } from "./CreateUserForm";
import { deleteUserAction, updateUserRoleAction } from "./actions";

export default async function UsersPage({
  searchParams,
}: PageProps<"/users">) {
  const session = await requireAdmin();
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;

  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader title="Utilisateurs" description="Gestion des comptes et des rôles (administrateurs uniquement)" />

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Nouvel utilisateur</h2>
          <CreateUserForm />
        </Card>

        <Card className="overflow-x-auto lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Créé le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.name}
                    {u.id === session.sub ? <span className="ml-1 text-xs text-slate-400">(vous)</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <form action={updateUserRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="VENDEUR">Vendeur</option>
                        <option value="ADMIN">Administrateur</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-600">
                        <input type="checkbox" name="active" defaultChecked={u.active} />
                        actif
                      </label>
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Mettre à jour
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active ? "success" : "default"}>{u.active ? "Actif" : "Inactif"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    {u.id !== session.sub ? (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Supprimer l'utilisateur "${u.name}" ?`}
                          className={buttonClasses("danger")}
                        >
                          Supprimer
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
