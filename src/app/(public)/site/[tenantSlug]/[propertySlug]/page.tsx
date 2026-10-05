import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";

export default async function PropertySite({params}:{params:Promise<{tenantSlug:string;propertySlug:string}>}) {
  const {tenantSlug,propertySlug}=await params;
  const property=await db.property.findFirst({where:{slug:propertySlug,isActive:true,isPublished:true,tenant:{slug:tenantSlug,status:"ACTIVE"}},include:{images:{orderBy:{sortOrder:"asc"}},tenant:true}});
  if(!property) notFound();
  return <main className="mx-auto max-w-6xl px-6 py-10"><p className="text-sm font-medium text-slate-500">{property.tenant.name}</p><h1 className="mt-2 text-4xl font-bold">{property.name}</h1><p className="mt-4 max-w-3xl text-slate-600">{property.description}</p><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{property.images.map(image=><img key={image.id} src={image.url} alt={image.alt??property.name} className="aspect-[4/3] w-full rounded-xl object-cover" />)}</section><section className="mt-10 rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Réserver</h2><p className="mt-2 text-slate-600">Calendrier et calculateur de prix à implémenter.</p></section></main>;
}