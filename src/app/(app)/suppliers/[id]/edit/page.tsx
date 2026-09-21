import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { SupplierForm } from "../../SupplierForm";

export default async function EditSupplierPage({
  params,
}: PageProps<"/suppliers/[id]/edit">) {
  const { id } = await params;
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  return (
    <div>
      <PageHeader title="Modifier le fournisseur" description={supplier.name} />
      <Card className="max-w-xl p-5">
        <SupplierForm supplier={supplier} />
      </Card>
    </div>
  );
}
