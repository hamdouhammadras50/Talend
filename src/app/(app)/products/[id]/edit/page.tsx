import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { ProductForm } from "../../ProductForm";

export default async function EditProductPage({
  params,
}: PageProps<"/products/[id]/edit">) {
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div>
      <PageHeader title="Modifier le produit" description={product.name} />
      <Card className="max-w-2xl p-5">
        <ProductForm product={product} />
      </Card>
    </div>
  );
}
