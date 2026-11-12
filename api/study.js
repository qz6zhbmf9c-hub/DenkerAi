// GET /api/study?collectionId=ID -> today's queue in Anki order, plus counters.
// Each card carries `delays`: minutes until it returns for Again/Hard/Good/Easy.
import { prisma } from './_lib/db.js';
import { allowMethods, json, withUser } from './_lib/auth.js';
import { buildQueue, previewDelays } from './_lib/srs.js';
import { newStartedToday } from './_lib/queries.js';

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['GET'])) return;
  const collectionId = String(req.query.collectionId || '');
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId: user.id },
    include: { cards: true },
  });
  if (!collection) return json(res, 404, { error: 'Collection not found.' });

  const started = (await newStartedToday(user.id))[collection.id] || 0;
  const queue = buildQueue(collection.cards, new Date(), started);

  json(res, 200, {
    collection: { id: collection.id, title: collection.title, level: collection.level },
    counts: {
      new: queue.filter((c) => c.state === 'new').length,
      learning: queue.filter((c) => c.state === 'learning' || c.state === 'relearning').length,
      review: queue.filter((c) => c.state === 'review').length,
    },
    cards: queue.map((c) => ({
      id: c.id,
      german: c.german,
      english: c.english,
      partOfSpeech: c.partOfSpeech,
      gender: c.gender,
      exampleDe: c.exampleDe,
      exampleEn: c.exampleEn,
      state: c.state,
      delays: previewDelays(c),
    })),
  });
});
