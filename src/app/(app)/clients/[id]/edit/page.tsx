import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { ClientForm } from "../../ClientForm";

export default async function EditClientPage({
  params,
}: PageProps<"/clients/[id]/edit">) {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <div>
      <PageHeader title="Modifier le client" description={client.name} />
      <Card className="max-w-xl p-5">
        <ClientForm client={client} />
      </Card>
    </div>
  );
}
