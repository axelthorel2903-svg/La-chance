// Fonction serveur (Vercel) : crée une session de paiement Stripe pour N enveloppes.
// Ne contient jamais votre clé secrète côté navigateur — elle vit uniquement
// ici, en variable d'environnement (STRIPE_SECRET_KEY).

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const UNIT_AMOUNT = 99; // 0,99 € en centimes
const MAX_QTY = 10;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const rawQty = (req.body && req.body.quantity) || 1;
    const quantity = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(rawQty)) || 1));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'Enveloppe — La Chance, Édition Nocturne' },
            unit_amount: UNIT_AMOUNT,
          },
          quantity: quantity,
        },
      ],
      // La quantité est stockée ici pour que le webhook sache combien de
      // tickets tirer et combien d'enveloppes décompter du stock.
      metadata: { quantity: String(quantity) },
      // Stripe Checkout gère automatiquement carte, Apple Pay et Google Pay :
      // rien à coder en plus pour les afficher.
      success_url: `${req.headers.origin}/?paiement=succes&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?paiement=annule`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Erreur Stripe:', err.message);
    res.status(500).json({ error: err.message });
  }
};
