// Fonction serveur (Vercel) : crée une session de paiement Stripe.
// Ne contient jamais votre clé secrète côté navigateur — elle vit uniquement
// ici, en variable d'environnement (STRIPE_SECRET_KEY).

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'Enveloppe — La Chance, Édition Nocturne' },
            unit_amount: 99, // 0,99 € en centimes
          },
          quantity: 1,
        },
      ],
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
