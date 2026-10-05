import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";

export default async function TenantSite({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await db.tenant.findFirst({
    where: { slug: tenantSlug, status: "ACTIVE" },
    include: {
      properties: {
        where: { isActive: true, isPublished: true },
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!tenant) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-sm font-semibold text-indigo-600">HOSTLY</p>
          <h1 className="mt-1 text-3xl font-bold">{tenant.name}</h1>
          <p className="mt-2 text-slate-500">
            {tenant.city}
            {tenant.country ? " · " + tenant.country : ""}
          </p>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-10 md:grid-cols-2 lg:grid-cols-3">
        {tenant.properties.map((property) => {
          const propertyHref = `/site/${tenant.slug}/${property.slug}` as Route;

          return (
            <Link
              key={property.id}
              href={propertyHref}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md"
            >
              <div className="aspect-[4/3] bg-slate-100">
                {property.images[0] ? (
                  <img
                    src={property.images[0].url}
                    alt={property.images[0].alt ?? property.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="p-5">
                <h2 className="text-lg font-semibold">{property.name}</h2>
                <p className="mt-2 text-sm text-slate-500">{property.shortDescription}</p>
                <p className="mt-4 font-semibold">{property.baseNightlyRate.toString()} € / nuit</p>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
