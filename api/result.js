// Renvoie les résultats (un tableau : perdant / rare / gagnant, un par
// enveloppe achetée) tirés par le webhook pour une session de paiement donnée.
// Le navigateur interroge cet endpoint après avoir été redirigé depuis Stripe,
// avec le session_id fourni dans l'URL de retour.

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

module.exports = async function handler(req, res) {
  const sessionId = req.query.session_id;
  if(!sessionId){
    return res.status(400).json({ error: 'session_id manquant' });
  }

  try {
    const redis = await getClient();
    const raw = await redis.get('result:' + sessionId);
    if(raw === null || raw === undefined){
      // Le webhook n'a peut-être pas encore fini de traiter l'événement.
      return res.status(404).json({ error: 'résultat pas encore disponible' });
    }
    let tiers;
    try {
      tiers = JSON.parse(raw);
      if(!Array.isArray(tiers)) tiers = [raw]; // compatibilité avec l'ancien format
    } catch {
      tiers = [raw]; // ancien format : une seule valeur texte, pas du JSON
    }
    res.status(200).json({ tiers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
