"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  type: z.enum(["GROS", "DETAIL"]),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export type ClientFormState = { error?: string };

function parseForm(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
  });
}

export async function createClient(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await db.client.create({ data: parsed.data });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Client introuvable." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await db.client.update({ where: { id }, data: parsed.data });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function deleteClient(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sales = await db.sale.count({ where: { clientId: id } });
  if (sales > 0) {
    redirect(
      `/clients?error=${encodeURIComponent(
        "Impossible de supprimer : des ventes sont liées à ce client."
      )}`
    );
  }

  await db.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}
