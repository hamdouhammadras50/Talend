"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  location: z.string().trim().optional(),
});

export type WarehouseFormState = { error?: string };

export async function createWarehouse(
  _prevState: WarehouseFormState,
  formData: FormData
): Promise<WarehouseFormState> {
  await requireUser();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await db.warehouse.create({ data: parsed.data });
  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export async function updateWarehouse(
  _prevState: WarehouseFormState,
  formData: FormData
): Promise<WarehouseFormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Entrepôt introuvable." };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await db.warehouse.update({ where: { id }, data: parsed.data });
  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export async function deleteWarehouse(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [lots, purchases, sales] = await Promise.all([
    db.stockLot.count({ where: { warehouseId: id, quantityLiters: { gt: 0 } } }),
    db.purchase.count({ where: { warehouseId: id } }),
    db.sale.count({ where: { warehouseId: id } }),
  ]);

  if (lots > 0 || purchases > 0 || sales > 0) {
    redirect(
      `/warehouses?error=${encodeURIComponent(
        "Impossible de supprimer : cet entrepôt contient du stock ou a des mouvements liés."
      )}`
    );
  }

  await db.stockLot.deleteMany({ where: { warehouseId: id } });
  await db.warehouse.delete({ where: { id } });
  revalidatePath("/warehouses");
  redirect("/warehouses");
}
