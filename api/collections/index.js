// GET  /api/collections            -> the user's collections with progress numbers
// POST /api/collections            -> AI creates a collection. One of:
//        { prompt }                    a topic, 20 cards
//        { mode:'words', words, title? } the learner's own words, one card each
//        { mode:'photos', images }     1-5 JPEG data URLs, cards from what the photos show
import { prisma } from '../_lib/db.js';
import { allowMethods, cleanString, json, withUser } from '../_lib/auth.js';
import { generateCollection, generateFromPhotos, generateFromWords } from '../_lib/ai.js';
import { newStartedToday, summarize } from '../_lib/queries.js';

const GENDERS = ['masculine', 'feminine', 'neuter'];
const MAX_WORDS = 30;
const MAX_PHOTOS = 5;
const MAX_PHOTO_CHARS = 1_000_000; // per image, as base64 (Vercel's request limit is 4.5 MB in total)
const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

/** Validates and cleans every card the AI returned before it is saved. */
function cleanCards(rawCards, max) {
  const seen = new Set();
  const cards = [];
  for (const c of rawCards.slice(0, max)) {
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
  return cards;
}

/** Cleans the typed word list: trimmed, no empty lines, no duplicates, at most MAX_WORDS. */
function cleanWords(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const words = [];
  for (const item of input) {
    const word = cleanString(item, 80);
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    words.push(word);
  }
  return words.slice(0, MAX_WORDS);
}


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
  if (!user.level) return json(res, 400, { error: 'Choose your level first.' });
  const mode = req.body?.mode || 'topic';
  const failed = { error: 'Denki got confused. Please try again.' };

  let generated;
  let prompt; // stored on the collection; for words/photos it is just a short description
  let maxCards = 20;
  let minCards = 5;
  let fallbackTitle;
  let customTitle = '';

  try {
    if (mode === 'words') {
      const words = cleanWords(req.body?.words);
      if (words.length === 0) return json(res, 400, { error: 'Type at least one word.' });
      customTitle = cleanString(req.body?.title, 40);
      prompt = words.join(', ').slice(0, 120);
      fallbackTitle = 'My words';
      maxCards = MAX_WORDS;
      minCards = 1;
      generated = await generateFromWords(user.level, words);
    } else if (mode === 'photos') {
      const images = req.body?.images;
      if (!Array.isArray(images) || images.length < 1 || images.length > MAX_PHOTOS) {
        return json(res, 400, { error: `Add between 1 and ${MAX_PHOTOS} photos.` });
      }
      if (!images.every((i) => typeof i === 'string' && i.length <= MAX_PHOTO_CHARS && JPEG_DATA_URL.test(i))) {
        return json(res, 400, { error: 'One of the photos could not be read. Please try another one.' });
      }
      prompt = `Photos (${images.length})`;
      fallbackTitle = 'My photos';
      minCards = 1;
      generated = await generateFromPhotos(user.level, images);
    } else {
      prompt = cleanString(req.body?.prompt, 120);
      if (prompt.length < 2) return json(res, 400, { error: 'Tell me what you want to learn.' });
      fallbackTitle = prompt;
      generated = await generateCollection(user.level, prompt);
    }
  } catch (err) {
    console.error(err);
    return json(res, 502, failed);
  }

  const cards = cleanCards(generated.cards, maxCards);
  if (cards.length < minCards) {
    if (mode === 'photos') {
      return json(res, 422, { error: "Denki couldn't find anything to learn in those photos. Try a clearer picture." });
    }
    return json(res, 502, failed);
  }

  const collection = await prisma.collection.create({
    data: {
      userId: user.id,
      title: customTitle || cleanString(generated.title, 40) || fallbackTitle,
      prompt,
      level: user.level,
      cards: { create: cards },
    },
  });
  json(res, 201, { id: collection.id, title: collection.title, count: cards.length });
});
