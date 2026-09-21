# StockHuile — Gestion de stock d'huile

Application web de gestion de stock pour l'achat et la revente d'huile
(gros / détail), avec suivi des entrepôts, des mouvements de stock, des
achats et des ventes.

## Stack technique

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, TypeScript)
- [Prisma](https://www.prisma.io) + SQLite (base de données locale, fichier unique)
- [Tailwind CSS 4](https://tailwindcss.com)
- Authentification maison (JWT en cookie httpOnly via [`jose`](https://github.com/panva/jose), mots de passe hashés avec `bcryptjs`)

## Fonctionnalités

- **Produits** : catalogue des huiles, volume par conteneur, prix de gros/détail, seuil de stock minimum
- **Entrepôts** : plusieurs points de stockage
- **Stock** : quantités disponibles par produit et par entrepôt, alertes de stock bas, ajustements manuels (inventaire, casse…)
- **Achats** : réception de conteneurs auprès des fournisseurs, mise à jour automatique du stock
- **Ventes** : vente en gros ou au détail, sélection de client, vérification du stock disponible avant validation
- **Clients / Fournisseurs** : carnets d'adresses avec type (gros/détail) pour les clients
- **Tableau de bord** : stock total, ventes/achats du mois, alertes de stock bas, derniers mouvements
- **Utilisateurs** : gestion des comptes et des rôles (Administrateur / Vendeur), réservée aux administrateurs

## Démarrage

```bash
npm install
cp .env.example .env   # puis personnalisez SESSION_SECRET
npm run db:push        # crée la base SQLite à partir du schéma Prisma
npm run db:seed        # données de démonstration (utilisateur admin, produits, entrepôts…)
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Compte de démonstration créé par le seed :

- Email : `admin@stockhuile.local`
- Mot de passe : `admin1234` (ou la valeur de `SEED_ADMIN_PASSWORD` si définie)

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` / `npm run start` — build et lancement en production
- `npm run lint` — ESLint
- `npm run db:push` — synchronise la base SQLite avec `prisma/schema.prisma`
- `npm run db:seed` — recharge les données de démonstration
- `npm run db:studio` — interface Prisma Studio pour explorer la base

## Notes de déploiement

- La base de données est un simple fichier SQLite (`prisma/dev.db`, ignoré par git). Pour la production, changez `DATABASE_URL` dans `.env` (Postgres/MySQL supportés par Prisma) si un usage multi-instance ou plus de robustesse est nécessaire.
- Définissez une valeur longue et aléatoire pour `SESSION_SECRET` en production.
