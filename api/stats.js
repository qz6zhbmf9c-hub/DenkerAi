// GET /api/stats -> numbers for the three dashboard tiles.
import { prisma } from './_lib/db.js';
import { allowMethods, json, withUser } from './_lib/auth.js';
import { newStartedToday, summarize } from './_lib/queries.js';

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['GET'])) return;
  const [collections, started] = await Promise.all([
    prisma.collection.findMany({
      where: { userId: user.id },
      include: { cards: { select: { state: true, due: true } } },
    }),
    newStartedToday(user.id),
  ]);

  let total = 0;
  let learned = 0;
  let due = 0;
  for (const c of collections) {
    const s = summarize(c.cards, started[c.id] || 0);
    total += s.total;
    learned += s.learned;
    due += s.due;
  }
  json(res, 200, {
    dueToday: due,
    wordsLearned: learned,
    progress: total ? Math.round((learned / total) * 100) : 0,
    collections: collections.length,
  });
});
