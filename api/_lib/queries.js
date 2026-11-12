// Shared database queries used by several routes.
import { prisma } from './db.js';
import { CONFIG } from './srs.js';

/** Start of the current day (UTC). Used for the 20-new-cards-per-day limit. */
export function startOfToday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** How many brand-new cards this user has started today, per collection. */
export async function newStartedToday(userId, now = new Date()) {
  const logs = await prisma.reviewLog.findMany({
    where: { userId, prevState: 'new', reviewedAt: { gte: startOfToday(now) } },
    select: { card: { select: { collectionId: true } } },
  });
  const perCollection = {};
  for (const l of logs) perCollection[l.card.collectionId] = (perCollection[l.card.collectionId] || 0) + 1;
  return perCollection;
}

/** Counts for one collection's cards: total, learned (state review) and due now. */
export function summarize(cards, startedToday = 0, now = new Date()) {
  const t = now.getTime();
  const total = cards.length;
  const learned = cards.filter((c) => c.state === 'review').length;
  const dueExisting = cards.filter((c) => c.state !== 'new' && c.due.getTime() <= t).length;
  const newCount = cards.filter((c) => c.state === 'new').length;
  const newAvailable = Math.min(newCount, Math.max(0, CONFIG.newPerDay - startedToday));
  return { total, learned, due: dueExisting + newAvailable };
}
