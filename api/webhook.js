// Webhook Stripe : Stripe appelle CETTE fonction directement (pas le navigateur
// du client) pour confirmer qu'un paiement a réellement abouti. C'est la seule
// source fiable — ne jamais faire confiance à la redirection du navigateur seule.

const Stripe = require('stripe');
const { createClient } = require('redis');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

let client;
async function getClient(){
  if(!client){
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Erreur Redis :', err));
  }
  if(!client.isOpen){
    await client.connect();
  }
  return client;
}

const KEY = 'stock_remaining';

module.exports = async function handler(req, res) {
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

    const redis = await getClient();
    const current = await redis.get(KEY);
    if(current === null || current === undefined){
      await redis.set(KEY, 200);
    }
    const remaining = await redis.decr(KEY);
    if(remaining < 0){
      await redis.set(KEY, 0); // sécurité anti-survente si jamais ça passe sous 0
    }

    // Reste à faire (voir README) : tirer le ticket (perdant / rare / gagnant)
    // et l'associer à session.id pour que la page de résultat puisse le relire.
  }

  res.json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}
