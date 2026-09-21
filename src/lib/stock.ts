import "server-only";
import { db } from "@/lib/db";
import type { ClientType, Prisma } from "@prisma/client";

export class StockError extends Error {}

export type LineInput = {
  productId: string;
  quantityContainers: number;
  quantityLiters: number;
  unitPriceOrCost: number;
};

async function nextReference(
  tx: Prisma.TransactionClient,
  model: "purchase" | "sale",
  prefix: string
) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const count =
    model === "purchase"
      ? await tx.purchase.count({ where: { createdAt: { gte: yearStart } } })
      : await tx.sale.count({ where: { createdAt: { gte: yearStart } } });

  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
}

async function upsertStockLot(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string,
  deltaLiters: number
) {
  const existing = await tx.stockLot.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });

  if (!existing) {
    return tx.stockLot.create({
      data: { productId, warehouseId, quantityLiters: deltaLiters },
    });
  }

  return tx.stockLot.update({
    where: { id: existing.id },
    data: { quantityLiters: existing.quantityLiters + deltaLiters },
  });
}

export async function createPurchase(input: {
  supplierId?: string | null;
  warehouseId: string;
  date: Date;
  notes?: string | null;
  createdById?: string | null;
  lines: LineInput[];
}) {
  if (input.lines.length === 0) {
    throw new StockError("Un achat doit contenir au moins une ligne.");
  }

  return db.$transaction(async (tx) => {
    const reference = await nextReference(tx, "purchase", "ACH");

    let totalCost = 0;
    const lineData = input.lines.map((line) => {
      const lineTotal = line.quantityLiters * line.unitPriceOrCost;
      totalCost += lineTotal;
      return {
        productId: line.productId,
        quantityContainers: line.quantityContainers,
        quantityLiters: line.quantityLiters,
        unitCostPerLiter: line.unitPriceOrCost,
        lineTotal,
      };
    });

    const purchase = await tx.purchase.create({
      data: {
        reference,
        supplierId: input.supplierId || null,
        warehouseId: input.warehouseId,
        date: input.date,
        notes: input.notes || null,
        totalCost,
        createdById: input.createdById || null,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    for (const line of input.lines) {
      await upsertStockLot(tx, line.productId, input.warehouseId, line.quantityLiters);
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId: input.warehouseId,
          type: "ENTREE",
          quantityLiters: line.quantityLiters,
          reference: purchase.reference,
        },
      });
    }

    return purchase;
  });
}

export async function createSale(input: {
  clientId?: string | null;
  warehouseId: string;
  saleType: ClientType;
  date: Date;
  notes?: string | null;
  createdById?: string | null;
  lines: LineInput[];
}) {
  if (input.lines.length === 0) {
    throw new StockError("Une vente doit contenir au moins une ligne.");
  }

  return db.$transaction(async (tx) => {
    // Vérifier le stock disponible pour chaque produit avant toute écriture.
    for (const line of input.lines) {
      const lot = await tx.stockLot.findUnique({
        where: {
          productId_warehouseId: {
            productId: line.productId,
            warehouseId: input.warehouseId,
          },
        },
        include: { product: true },
      });

      const available = lot?.quantityLiters ?? 0;
      if (available < line.quantityLiters) {
        const product = lot?.product ?? (await tx.product.findUnique({ where: { id: line.productId } }));
        throw new StockError(
          `Stock insuffisant pour "${product?.name ?? "produit"}" : disponible ${available.toFixed(
            1
          )} L, demandé ${line.quantityLiters.toFixed(1)} L.`
        );
      }
    }

    const reference = await nextReference(tx, "sale", "VTE");

    let totalAmount = 0;
    const lineData = input.lines.map((line) => {
      const lineTotal = line.quantityLiters * line.unitPriceOrCost;
      totalAmount += lineTotal;
      return {
        productId: line.productId,
        quantityContainers: line.quantityContainers,
        quantityLiters: line.quantityLiters,
        unitPricePerLiter: line.unitPriceOrCost,
        lineTotal,
      };
    });

    const sale = await tx.sale.create({
      data: {
        reference,
        clientId: input.clientId || null,
        warehouseId: input.warehouseId,
        saleType: input.saleType,
        date: input.date,
        notes: input.notes || null,
        totalAmount,
        createdById: input.createdById || null,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    for (const line of input.lines) {
      await upsertStockLot(tx, line.productId, input.warehouseId, -line.quantityLiters);
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId: input.warehouseId,
          type: "SORTIE",
          quantityLiters: -line.quantityLiters,
          reference: sale.reference,
        },
      });
    }

    return sale;
  });
}

export async function adjustStock(input: {
  productId: string;
  warehouseId: string;
  deltaLiters: number;
  note?: string | null;
}) {
  if (input.deltaLiters === 0) {
    throw new StockError("L'ajustement doit être différent de zéro.");
  }

  return db.$transaction(async (tx) => {
    if (input.deltaLiters < 0) {
      const lot = await tx.stockLot.findUnique({
        where: {
          productId_warehouseId: {
            productId: input.productId,
            warehouseId: input.warehouseId,
          },
        },
      });
      const available = lot?.quantityLiters ?? 0;
      if (available + input.deltaLiters < 0) {
        throw new StockError(
          `Ajustement impossible : stock disponible ${available.toFixed(1)} L.`
        );
      }
    }

    await upsertStockLot(tx, input.productId, input.warehouseId, input.deltaLiters);

    return tx.stockMovement.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: "AJUSTEMENT",
        quantityLiters: input.deltaLiters,
        note: input.note || null,
      },
    });
  });
}
