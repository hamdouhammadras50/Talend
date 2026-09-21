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

  const [entrepotDakar, entrepotThies] = await Promise.all([
    db.warehouse.upsert({
      where: { id: "seed-wh-dakar" },
      update: {},
      create: { id: "seed-wh-dakar", name: "Entrepôt Dakar", location: "Zone industrielle, Dakar" },
    }),
    db.warehouse.upsert({
      where: { id: "seed-wh-thies" },
      update: {},
      create: { id: "seed-wh-thies", name: "Entrepôt Thiès", location: "Zone industrielle, Thiès" },
    }),
  ]);

  const products = await Promise.all(
    [
      {
        id: "seed-p-kama",
        name: "Kama",
        litersPerContainer: 200,
        wholesalePrice: 750,
        retailPrice: 1000,
        minStockLiters: 1000,
      },
      {
        id: "seed-p-arachide",
        name: "Huile d'arachide",
        litersPerContainer: 200,
        wholesalePrice: 800,
        retailPrice: 1050,
        minStockLiters: 800,
      },
      {
        id: "seed-p-tournesol",
        name: "Huile de tournesol",
        litersPerContainer: 200,
        wholesalePrice: 700,
        retailPrice: 950,
        minStockLiters: 800,
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
      name: "Huilerie du Saloum",
      phone: "+221 33 800 00 00",
      email: "contact@huilerie-saloum.sn",
      address: "Route de Kaolack, Kaolack",
    },
  });

  const [clientGros, clientDetail] = await Promise.all([
    db.client.upsert({
      where: { id: "seed-c-gros" },
      update: {},
      create: {
        id: "seed-c-gros",
        name: "Supermarché Teranga",
        type: "GROS",
        phone: "+221 77 800 00 01",
      },
    }),
    db.client.upsert({
      where: { id: "seed-c-detail" },
      update: {},
      create: {
        id: "seed-c-detail",
        name: "Épicerie Ndiaye",
        type: "DETAIL",
        phone: "+221 77 800 00 02",
      },
    }),
  ]);

  const [kama, arachide] = products;

  const existingPurchase = await db.purchase.findUnique({ where: { reference: "ACH-DEMO-0001" } });
  if (!existingPurchase) {
    const purchase = await db.purchase.create({
      data: {
        reference: "ACH-DEMO-0001",
        supplierId: supplier.id,
        warehouseId: entrepotDakar.id,
        date: new Date(),
        totalCost: 5 * 200 * 600 + 10 * 200 * 650,
        createdById: admin.id,
        lines: {
          create: [
            {
              productId: kama.id,
              quantityContainers: 5,
              quantityLiters: 5 * 200,
              unitCostPerLiter: 600,
              lineTotal: 5 * 200 * 600,
            },
            {
              productId: arachide.id,
              quantityContainers: 10,
              quantityLiters: 10 * 200,
              unitCostPerLiter: 650,
              lineTotal: 10 * 200 * 650,
            },
          ],
        },
      },
    });

    for (const line of [
      { productId: kama.id, liters: 5 * 200 },
      { productId: arachide.id, liters: 10 * 200 },
    ]) {
      await db.stockLot.upsert({
        where: { productId_warehouseId: { productId: line.productId, warehouseId: entrepotDakar.id } },
        update: { quantityLiters: { increment: line.liters } },
        create: { productId: line.productId, warehouseId: entrepotDakar.id, quantityLiters: line.liters },
      });
      await db.stockMovement.create({
        data: {
          productId: line.productId,
          warehouseId: entrepotDakar.id,
          type: "ENTREE",
          quantityLiters: line.liters,
          reference: purchase.reference,
        },
      });
    }
  }

  console.log("Seed terminé.");
  console.log(`Connexion admin : admin@stockhuile.local / ${adminPassword}`);
  console.log(`Entrepôts: ${entrepotDakar.name}, ${entrepotThies.name}`);
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
