// POST /api/review  { cardId, rating: 1..4 }
// Applies the SM-2 scheduler, saves the card and writes a ReviewLog row.
import { prisma } from './_lib/db.js';
import { allowMethods, json, withUser } from './_lib/auth.js';
import { previewDelays, schedule } from './_lib/srs.js';

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const cardId = String(req.body?.cardId || '');
  const rating = req.body?.rating;
  if (![1, 2, 3, 4].includes(rating)) return json(res, 400, { error: 'Rating must be 1 to 4.' });

  // The collection filter ensures the card belongs to this user.
  const card = await prisma.card.findFirst({ where: { id: cardId, collection: { userId: user.id } } });
  if (!card) return json(res, 404, { error: 'Card not found.' });

  const { delayMinutes, ...next } = schedule(card, rating, new Date());
  const [updated] = await prisma.$transaction([
    prisma.card.update({ where: { id: card.id }, data: next }),
    prisma.reviewLog.create({
      data: { userId: user.id, cardId: card.id, rating, prevState: card.state, newIntervalDays: next.intervalDays },
    }),
  ]);

  json(res, 200, {
    card: { id: updated.id, state: updated.state, due: updated.due, delayMinutes, delays: previewDelays(updated) },
  });
});
