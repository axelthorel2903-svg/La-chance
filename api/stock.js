// Renvoie le nombre d'enveloppes restantes, partagé entre tous les visiteurs.
// Utilise la base Redis connectée via l'onglet "Storage" de Vercel
// (variable d'environnement REDIS_URL, fournie automatiquement).

const { createClient } = require('redis');

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

const TOTAL = 200;
const KEY = 'stock_remaining';

module.exports = async function handler(req, res) {
  try {
    const redis = await getClient();
    let remaining = await redis.get(KEY);
    if(remaining === null || remaining === undefined){
      remaining = TOTAL;
      await redis.set(KEY, TOTAL);
    }
    res.status(200).json({ remaining: Number(remaining), total: TOTAL });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
