import { db } from "@/lib/prisma";
import { auth } from "@/auth";
export default async function SuperAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") return <main className="p-8">Accès refusé.</main>;
  const [tenants,properties,bookings] = await Promise.all([db.tenant.count(),db.property.count(),db.booking.count()]);
  return <main className="p-8"><h1 className="text-3xl font-bold">Super Admin</h1><div className="mt-6 grid gap-4 md:grid-cols-3">{[[ "Tenants",tenants ],[ "Logements",properties ],[ "Réservations",bookings ]].map(([label,value])=><div key={label} className="rounded-xl border bg-white p-5"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold">{value}</div></div>)}</div></main>;
}