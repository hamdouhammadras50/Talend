"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export type SupplierFormState = { error?: string };

function parseForm(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
  });
}

export async function createSupplier(
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await db.supplier.create({ data: parsed.data });
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplier(
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Fournisseur introuvable." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await db.supplier.update({ where: { id }, data: parsed.data });
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const purchases = await db.purchase.count({ where: { supplierId: id } });
  if (purchases > 0) {
    redirect(
      `/suppliers?error=${encodeURIComponent(
        "Impossible de supprimer : des achats sont liés à ce fournisseur."
      )}`
    );
  }

  await db.supplier.delete({ where: { id } });
  revalidatePath("/suppliers");
  redirect("/suppliers");
}
