"use client";

import { useActionState } from "react";
import type { Client } from "@prisma/client";
import { SubmitButton, FormError } from "@/components/ui";
import { createClient, updateClient, type ClientFormState } from "./actions";

const initialState: ClientFormState = {};
const inputClasses =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

export function ClientForm({ client }: { client?: Client }) {
  const action = client ? updateClient : createClient;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Nom du client *</label>
          <input name="name" required defaultValue={client?.name} className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Type de client *</label>
          <select name="type" defaultValue={client?.type ?? "DETAIL"} className={inputClasses}>
            <option value="DETAIL">Détail</option>
            <option value="GROS">Gros</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Téléphone</label>
          <input name="phone" defaultValue={client?.phone ?? ""} className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input name="email" type="email" defaultValue={client?.email ?? ""} className={inputClasses} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Adresse</label>
        <input name="address" defaultValue={client?.address ?? ""} className={inputClasses} />
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton>{client ? "Enregistrer" : "Créer le client"}</SubmitButton>
      </div>
    </form>
  );
}
