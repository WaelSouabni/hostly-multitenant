# Hostly — architecture multi-tenant

## Dossiers App Router

- `(auth)`: authentification.
- `(admin)/super-admin`: administration globale.
- `(admin)/host`: espace privé de chaque hôte.
- `(public)/site/[tenantSlug]/[propertySlug]`: site public par slug.
- `site/[tenantSlug]/[propertySlug]`: cible de réécriture pour les sous-domaines.
- `actions/host`: Server Actions sécurisées.

## Isolation

Le navigateur ne fournit jamais le tenantId pour autoriser une lecture ou une mutation. Le serveur obtient l'utilisateur avec `auth()`, recharge son `tenantId` depuis PostgreSQL et injecte cette valeur dans chaque requête métier.

Pour une mutation, vérifier dans la même transaction que la ressource appartient au tenant avant de la modifier.

## Sous-domaines

`studio-a.plateforme.com` est réécrit vers `/site/studio-a/`. Pour un domaine personnalisé, `PropertyDomain` permet de résoudre l'hôte vers le logement.

## Anti-surbooking

La création d'une réservation doit être atomique. PostgreSQL doit verrouiller le logement pendant le contrôle des chevauchements puis la création de la réservation. Une migration SQL dédiée pourra utiliser un advisory lock ou une exclusion constraint selon la stratégie retenue.

## Facturation

`Invoice` et `InvoiceItem` conservent un snapshot des montants facturés. Les informations légales du tenant sont stockées dans `Tenant` afin que les factures restent cohérentes avec le propriétaire du logement.