// Gère le tapis rouge des vrais gagnants.
// GET  : renvoie la liste des derniers gagnants (pour l'afficher sur le site).
// POST : enregistre un pseudo pour une session de paiement — mais seulement si
//        cette session a réellement tiré le ticket gagnant (vérifié ici, jamais
//        fait confiance au navigateur), et une seule fois par gagnant.

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

const CURRENT_EDITION = '007'; // à monter manuellement à chaque nouvelle édition
const MAX_WINNERS = 20;

function sanitizePseudo(raw){
  if(typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, 24);
  if(!trimmed) return null;
  // Lettres (accents inclus), chiffres, espace, point, tiret, underscore uniquement.
  if(!/^[\p{L}\p{N} ._-]+$/u.test(trimmed)) return null;
  return trimmed;
}

module.exports = async function handler(req, res) {
  const redis = await getClient();

  if(req.method === 'GET'){
    try {
      const raw = await redis.lRange('winners', 0, MAX_WINNERS - 1);
      const winners = raw.map((item) => {
        try { return JSON.parse(item); } catch { return null; }
      }).filter(Boolean);
      return res.status(200).json({ winners });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if(req.method === 'POST'){
    try {
      const { sessionId, pseudo } = req.body || {};
      if(!sessionId){
        return res.status(400).json({ error: 'session_id manquant' });
      }
      const cleanPseudo = sanitizePseudo(pseudo);
      if(!cleanPseudo){
        return res.status(400).json({ error: 'pseudo invalide' });
      }

      const tier = await redis.get('result:' + sessionId);
      if(tier !== 'win'){
        return res.status(403).json({ error: "cette session n'est pas un ticket gagnant" });
      }

      const already = await redis.get('winner_submitted:' + sessionId);
      if(already){
        return res.status(409).json({ error: 'un pseudo a déjà été enregistré pour ce gagnant' });
      }

      const entry = {
        edition: CURRENT_EDITION,
        pseudo: cleanPseudo,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      };

      await redis.lPush('winners', JSON.stringify(entry));
      await redis.lTrim('winners', 0, MAX_WINNERS - 1);
      await redis.set('winner_submitted:' + sessionId, '1', { EX: 60 * 60 * 24 * 30 });

      return res.status(200).json({ ok: true, entry });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
};
