import Link from "next/link";
export default function HomePage() {
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6">
    <span className="text-sm font-semibold uppercase tracking-widest text-slate-500">Hostly</span>
    <h1 className="mt-3 text-5xl font-bold tracking-tight">Gestion locative multi-tenant.</h1>
    <p className="mt-5 max-w-2xl text-lg text-slate-600">Une plateforme pour les hôtes, logements, réservations, tarifs et sites publics.</p>
    <div className="mt-8 flex gap-3"><Link className="rounded-lg bg-slate-900 px-5 py-3 text-white" href="/login">Connexion</Link><Link className="rounded-lg border px-5 py-3" href="/host">Espace hôte</Link></div>
  </main>;
}