"use client";

import { useActionState } from "react";
import { SubmitButton, FormError } from "@/components/ui";
import { createUserAction, type UserFormState } from "./actions";

const initialState: UserFormState = {};
const inputClasses =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

export function CreateUserForm() {
  const [state, formAction] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Nom *</label>
          <input name="name" required className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Email *</label>
          <input name="email" type="email" required className={inputClasses} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Mot de passe *</label>
          <input name="password" type="password" required minLength={6} className={inputClasses} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Rôle *</label>
          <select name="role" defaultValue="VENDEUR" className={inputClasses}>
            <option value="VENDEUR">Vendeur</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </div>
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton>Créer l&apos;utilisateur</SubmitButton>
      </div>
    </form>
  );
}
