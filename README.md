# Hostly Multitenant

Plateforme Next.js App Router + TypeScript + PostgreSQL/Prisma pour la gestion multi-tenant de maisons d'hôtes et studios.

## Stack

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- Prisma + PostgreSQL
- NextAuth
- Architecture tenant-first

## Démarrage

1. Copier `.env.example` vers `.env`.
2. Renseigner `DATABASE_URL` et `AUTH_SECRET`.
3. Installer les dépendances avec `npm install`.
4. Générer Prisma : `npm run db:generate`.
5. Créer la base : `npm run db:migrate`.
6. Lancer : `npm run dev`.

Le socle d'architecture initial est sur la branche `develop`.
