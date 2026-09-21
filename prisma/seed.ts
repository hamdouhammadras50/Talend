import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";

  const admin = await db.user.upsert({
    where: { email: "admin@stockhuile.local" },
    update: {},
    create: {
      name: "Administrateur",
      email: "admin@stockhuile.local",
      password: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });

  const [entrepotCasa, entrepotRabat] = await Promise.all([
    db.warehouse.upsert({
      where: { id: "seed-wh-casa" },
      update: {},
      create: { id: "seed-wh-casa", name: "Entrepôt Casablanca", location: "Zone industrielle, Casablanca" },
    }),
    db.warehouse.upsert({
      where: { id: "seed-wh-rabat" },
      update: {},
      create: { id: "seed-wh-rabat", name: "Entrepôt Rabat", location: "Zone industrielle, Rabat" },
    }),
  ]);

  const products = await Promise.all(
    [
      {
        id: "seed-p-olive",
        name: "Huile d'olive extra vierge",
        litersPerContainer: 200,
        wholesalePrice: 45,
        retailPrice: 60,
        minStockLiters: 500,
      },
      {
        id: "seed-p-tournesol",
        name: "Huile de tournesol",
        litersPerContainer: 200,
        wholesalePrice: 15,
        retailPrice: 22,
        minStockLiters: 800,
      },
      {
        id: "seed-p-argan",
        name: "Huile d'argan",
        litersPerContainer: 20,
        wholesalePrice: 180,
        retailPrice: 250,
        minStockLiters: 100,
      },
    ].map((p) =>
      db.product.upsert({ where: { id: p.id }, update: {}, create: p })
    )
  );

  const supplier = await db.supplier.upsert({
    where: { id: "seed-sup-1" },
    update: {},
    create: {
      id: "seed-sup-1",
      name: "Coopérative Huilerie Atlas",
      phone: "+212 5 22 00 00 00",
      email: "contact@huilerie-atlas.ma",
      address: "Route de Fès, Meknès",
    },
  });

  const [clientGros, clientDetail] = await Promise.all([
    db.client.upsert({
      where: { id: "seed-c-gros" },
      update: {},
      create: {
        id: "seed-c-gros",
        name: "Supermarché Al Baraka",
        type: "GROS",
        phone: "+212 6 00 00 00 01",
      },
    }),
    db.client.upsert({
      where: { id: "seed-c-detail" },
      update: {},
      create: {
        id: "seed-c-detail",
        name: "Épicerie du Quartier",
        type: "DETAIL",
        phone: "+212 6 00 00 00 02",
      },
    }),
  ]);

  const [olive, tournesol] = products;

  const existingPurchase = await db.purchase.findUnique({ where: { reference: "ACH-DEMO-0001" } });
  if (!existingPurchase) {
    const purchase = await db.purchase.create({
      data: {
        reference: "ACH-DEMO-0001",
        supplierId: supplier.id,
        warehouseId: entrepotCasa.id,
        date: new Date(),
        totalCost: 5 * 200 * 30 + 10 * 200 * 10,
        createdById: admin.id,
        lines: {
          create: [
            {
              productId: olive.id,
              quantityContainers: 5,
              quantityLiters: 5 * 200,
              unitCostPerLiter: 30,
              lineTotal: 5 * 200 * 30,
            },
            {
              productId: tournesol.id,
              quantityContainers: 10,
              quantityLiters: 10 * 200,
              unitCostPerLiter: 10,
              lineTotal: 10 * 200 * 10,
            },
          ],
        },
      },
    });

    for (const line of [
      { productId: olive.id, liters: 5 * 200 },
      { productId: tournesol.id, liters: 10 * 200 },
    ]) {
      await db.stockLot.upsert({
        where: { productId_warehouseId: { productId: line.productId, warehouseId: entrepotCasa.id } },
        update: { quantityLiters: { increment: line.liters } },
        create: { productId: line.productId, warehouseId: entrepotCasa.id, quantityLiters: line.liters },
      });
      await db.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId: entrepotCasa.id,
          type: "ENTREE",
          quantityLiters: line.liters,
          reference: purchase.reference,
        },
      });
    }
  }

  console.log("Seed terminé.");
  console.log(`Connexion admin : admin@stockhuile.local / ${adminPassword}`);
  console.log(`Entrepôts: ${entrepotCasa.name}, ${entrepotRabat.name}`);
  console.log(`Clients: ${clientGros.name} (gros), ${clientDetail.name} (détail)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
