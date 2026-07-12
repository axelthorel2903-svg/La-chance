// Webhook Stripe : Stripe appelle CETTE fonction directement (pas le navigateur
// du client) pour confirmer qu'un paiement a réellement abouti. C'est la seule
// source fiable — ne jamais faire confiance à la redirection du navigateur seule.

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Erreur de signature webhook : ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // C'est ICI, et seulement ici, que doit se passer :
    //  1. La décrémentation du stock d'enveloppes en base de données.
    //  2. Le tirage du ticket (perdant / rare / gagnant), enregistré et
    //     associé à session.id pour que la page de résultat puisse le relire.
    // Exemple (pseudo-code, à adapter à votre base de données) :
    //
    // const roll = Math.random();
    // const tier = roll < 0.01 ? 'win' : roll < 0.11 ? 'rare' : 'lose';
    // await db.enveloppes.decrement();
    // await db.resultats.create({ sessionId: session.id, tier });
  }

  res.json({ received: true });
}

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}
