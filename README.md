# Brancher Stripe sur "La Chance"

## 1. Créer un compte Stripe
- Va sur https://dashboard.stripe.com/register
- Une fois connecté, tu es en **mode test** par défaut (aucun vrai argent ne bouge) — parfait pour commencer.

## 2. Récupérer tes clés
Dans le Dashboard Stripe → *Développeurs* → *Clés API* :
- **Clé publiable** (`pk_test_...`) — jamais secrète, mais on ne s'en sert pas ici puisqu'on utilise Stripe Checkout hébergé.
- **Clé secrète** (`sk_test_...`) — à ne JAMAIS mettre dans le HTML. Elle va en variable d'environnement.

## 3. Déployer sur Vercel (gratuit)
1. Crée un compte sur https://vercel.com (tu peux te connecter avec GitHub).
2. Mets ce dossier (avec ton `index.html` à la racine) dans un dépôt GitHub.
3. Sur Vercel : *Add New Project* → importe le dépôt → *Deploy*.
4. Dans les réglages du projet Vercel → *Environment Variables*, ajoute :
   - `STRIPE_SECRET_KEY` = ta clé secrète (`sk_test_...`)
   - `STRIPE_WEBHOOK_SECRET` = voir étape 5

## 4. Placer ton index.html
Mets le fichier `index.html` du site (celui qu'on a construit) directement à la racine du projet, à côté de `package.json` et du dossier `api/`.

## 5. Configurer le webhook
1. Dashboard Stripe → *Développeurs* → *Webhooks* → *Ajouter un endpoint*.
2. URL : `https://ton-site.vercel.app/api/webhook`
3. Événement à écouter : `checkout.session.completed`
4. Stripe te donne un secret de signature (`whsec_...`) → colle-le dans `STRIPE_WEBHOOK_SECRET` sur Vercel.

## 6. Apple Pay / Google Pay
Rien à coder : Stripe Checkout les active automatiquement dès que ton domaine est en HTTPS (ce que Vercel fait par défaut). Ils apparaîtront seuls sur la page de paiement si le visiteur a un moyen de paiement compatible.

## 7. Passer en vrai (mode live)
Une fois les tests concluants : bascule le Dashboard Stripe en *mode live*, récupère les clés `sk_live_...` / `whsec_live_...`, et remplace-les dans les variables d'environnement Vercel. Refais l'étape 5 (le webhook doit être recréé en mode live).

## Ce qui reste à faire ensuite
- Une vraie base de données pour le stock d'enveloppes et le tirage des tickets (le webhook contient déjà l'endroit exact où brancher ça).
- Une page de résultat qui relit le tirage via `session_id` au retour de Stripe, plutôt que de le calculer dans le navigateur.
