// Webhook Stripe : Stripe appelle CETTE fonction directement (pas le navigateur
// du client) pour confirmer qu'un paiement a réellement abouti. C'est la seule
// source fiable — ne jamais faire confiance à la redirection du navigateur seule.
// C'est ICI, et seulement ici, que sont tirés les tickets (perdant/rare/gagnant),
// un par enveloppe achetée, pour que ce soit infalsifiable depuis le navigateur.

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

const STOCK_KEY = 'stock_remaining';
const RARE_CHANCE = 0.10;
const WIN_CHANCE = 0.01;
const MAX_QTY = 10;

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
    const resultKey = 'result:' + session.id;

    // Idempotent : si Stripe renvoie deux fois le même événement (ça arrive),
    // on ne tire pas deux fois les tickets et on ne décrémente pas deux fois le stock.
    const already = await redis.get(resultKey);
    if(already === null){
      const rawQty = (session.metadata && session.metadata.quantity) || '1';
      const quantity = Math.min(MAX_QTY, Math.max(1, parseInt(rawQty, 10) || 1));

      const tiers = [];
      for(let i = 0; i < quantity; i++){
        const roll = Math.random();
        tiers.push(roll < WIN_CHANCE ? 'win' : (roll < WIN_CHANCE + RARE_CHANCE ? 'rare' : 'lose'));
      }
      await redis.set(resultKey, JSON.stringify(tiers), { EX: 60 * 60 * 24 }); // expire après 24h

      const current = await redis.get(STOCK_KEY);
      if(current === null || current === undefined){
        await redis.set(STOCK_KEY, 200);
      }
      let remaining = await redis.decrBy(STOCK_KEY, quantity);
      if(remaining < 0){
        await redis.set(STOCK_KEY, 0);
      }
    }
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
