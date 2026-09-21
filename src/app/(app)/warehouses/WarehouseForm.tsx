"use client";

import { useActionState } from "react";
import type { Warehouse } from "@prisma/client";
import { SubmitButton, FormError } from "@/components/ui";
import { createWarehouse, updateWarehouse, type WarehouseFormState } from "./actions";

const initialState: WarehouseFormState = {};

export function WarehouseForm({ warehouse }: { warehouse?: Warehouse }) {
  const action = warehouse ? updateWarehouse : createWarehouse;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {warehouse ? <input type="hidden" name="id" value={warehouse.id} /> : null}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Nom de l&apos;entrepôt *</label>
        <input
          name="name"
          required
          defaultValue={warehouse?.name}
          placeholder="Entrepôt Casablanca"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Localisation</label>
        <input
          name="location"
          defaultValue={warehouse?.location ?? ""}
          placeholder="Zone industrielle, Casablanca"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton>{warehouse ? "Enregistrer" : "Créer l'entrepôt"}</SubmitButton>
      </div>
    </form>
  );
}
