// GET  /api/collections            -> the user's collections with progress numbers
// POST /api/collections { prompt } -> AI creates a collection of 20 cards
import { prisma } from '../_lib/db.js';
import { allowMethods, cleanString, json, withUser } from '../_lib/auth.js';
import { generateCollection } from '../_lib/ai.js';
import { newStartedToday, summarize } from '../_lib/queries.js';

const GENDERS = ['masculine', 'feminine', 'neuter'];

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;

  if (req.method === 'GET') {
    const [collections, started] = await Promise.all([
      prisma.collection.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        include: { cards: { select: { state: true, due: true } } },
      }),
      newStartedToday(user.id),
    ]);
    return json(res, 200, {
      collections: collections.map((c) => ({
        id: c.id,
        title: c.title,
        level: c.level,
        ...summarize(c.cards, started[c.id] || 0),
      })),
    });
  }

  // POST: create a collection
  const prompt = cleanString(req.body?.prompt, 120);
  if (prompt.length < 2) return json(res, 400, { error: 'Tell me what you want to learn.' });
  if (!user.level) return json(res, 400, { error: 'Choose your level first.' });

  let generated;
  try {
    generated = await generateCollection(user.level, prompt);
  } catch (err) {
    console.error(err);
    return json(res, 502, { error: 'Denki got confused. Please try again.' });
  }

  // Validate and clean every card the AI returned before saving it.
  const seen = new Set();
  const cards = [];
  for (const c of generated.cards.slice(0, 20)) {
    const german = cleanString(c.german, 80);
    const english = cleanString(c.english, 120);
    const exampleDe = cleanString(c.exampleDe, 200);
    const exampleEn = cleanString(c.exampleEn, 200);
    if (!german || !english || !exampleDe || !exampleEn || seen.has(german.toLowerCase())) continue;
    seen.add(german.toLowerCase());
    const gender = cleanString(c.gender, 20).toLowerCase();
    cards.push({
      german,
      english,
      exampleDe,
      exampleEn,
      partOfSpeech: cleanString(c.partOfSpeech, 20).toLowerCase() || 'word',
      gender: GENDERS.includes(gender) ? gender : null,
    });
  }
  if (cards.length < 5) return json(res, 502, { error: 'Denki got confused. Please try again.' });

  const collection = await prisma.collection.create({
    data: {
      userId: user.id,
      title: cleanString(generated.title, 40) || prompt,
      prompt,
      level: user.level,
      cards: { create: cards },
    },
  });
  json(res, 201, { id: collection.id, title: collection.title, count: cards.length });
});
