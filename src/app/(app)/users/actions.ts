"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  email: z.string().trim().toLowerCase().email("Email invalide."),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
  role: z.enum(["ADMIN", "VENDEUR"]),
});

export type UserFormState = { error?: string };

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "Un utilisateur avec cet email existe déjà." };

  await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserRoleAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  const active = formData.get("active") === "on";
  if (!id || (role !== "ADMIN" && role !== "VENDEUR")) return;

  if (id === session.sub && (role !== "ADMIN" || !active)) {
    const adminCount = await db.user.count({ where: { role: "ADMIN", active: true } });
    if (adminCount <= 1) {
      redirect(
        `/users?error=${encodeURIComponent(
          "Impossible de vous retirer les droits admin : vous êtes le dernier administrateur actif."
        )}`
      );
    }
  }

  await db.user.update({ where: { id }, data: { role, active } });
  revalidatePath("/users");
  redirect("/users");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  if (id === session.sub) {
    redirect(`/users?error=${encodeURIComponent("Vous ne pouvez pas supprimer votre propre compte.")}`);
  }

  const [purchases, sales] = await Promise.all([
    db.purchase.count({ where: { createdById: id } }),
    db.sale.count({ where: { createdById: id } }),
  ]);
  if (purchases > 0 || sales > 0) {
    redirect(
      `/users?error=${encodeURIComponent(
        "Impossible de supprimer : cet utilisateur a des achats/ventes enregistrés. Désactivez-le à la place."
      )}`
    );
  }

  await db.user.delete({ where: { id } });
  revalidatePath("/users");
  redirect("/users");
}
