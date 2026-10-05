import { getTenantBookings } from "@/app/actions/host/bookings";
export default async function HostDashboard() {
  const bookings = await getTenantBookings();
  return <main className="p-8"><h1 className="text-3xl font-bold">Dashboard hôte</h1><p className="mt-2 text-slate-600">Réservations du tenant connecté : {bookings.length}</p></main>;
}