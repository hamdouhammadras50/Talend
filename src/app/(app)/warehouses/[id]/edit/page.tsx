import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { WarehouseForm } from "../../WarehouseForm";

export default async function EditWarehousePage({
  params,
}: PageProps<"/warehouses/[id]/edit">) {
  const { id } = await params;
  const warehouse = await db.warehouse.findUnique({ where: { id } });
  if (!warehouse) notFound();

  return (
    <div>
      <PageHeader title="Modifier l'entrepôt" description={warehouse.name} />
      <Card className="max-w-xl p-5">
        <WarehouseForm warehouse={warehouse} />
      </Card>
    </div>
  );
}
