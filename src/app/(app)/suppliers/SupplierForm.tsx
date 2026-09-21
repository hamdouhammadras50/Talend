"use client";

import { useActionState } from "react";
import type { Supplier } from "@prisma/client";
import { SubmitButton, FormError } from "@/components/ui";
import { createSupplier, updateSupplier, type SupplierFormState } from "./actions";

const initialState: SupplierFormState = {};
const inputClasses =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const action = supplier ? updateSupplier : createSupplier;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Nom du fournisseur *</label>
        <input name="name" required defaultValue={supplier?.name} className={inputClasses} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Téléphone</label>
          <input name="phone" defaultValue={supplier?.phone ?? ""} className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input name="email" type="email" defaultValue={supplier?.email ?? ""} className={inputClasses} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Adresse</label>
        <input name="address" defaultValue={supplier?.address ?? ""} className={inputClasses} />
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton>{supplier ? "Enregistrer" : "Créer le fournisseur"}</SubmitButton>
      </div>
    </form>
  );
}
