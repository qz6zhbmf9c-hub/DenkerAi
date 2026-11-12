// Spaced repetition scheduler, modelled on classic Anki (SM-2).
//
// Card states: "new" -> "learning" -> "review" <-> "relearning"
// Ratings:     1 = Again, 2 = Hard, 3 = Good, 4 = Easy
//
// All functions are pure (no database, no clock unless `now` is omitted) so
// they are easy to test. Intervals inside this file are measured in MINUTES
// for the learning phases and DAYS for the review phase.

export const CONFIG = {
  learningSteps: [1, 10], // minutes
  relearningSteps: [10], // minutes
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startEase: 2.5,
  minEase: 1.3,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  lapseNewInterval: 0, // Anki default: a lapsed card restarts from 1 day
  newPerDay: 20,
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Hard on the first learning step waits halfway to the next step (Anki rule). */
function hardLearningDelay(step) {
  const steps = CONFIG.learningSteps;
  if (step === 0 && steps.length > 1) return (steps[0] + steps[1]) / 2;
  return steps[Math.min(step, steps.length - 1)];
}

/**
 * Small random spread so cards learned together do not all come back on the
 * same day. Only applied from 3 days upward, +/- 5%.
 */
function fuzz(days, random = Math.random) {
  if (days < 3) return days;
  return days * (1 + (random() * 0.1 - 0.05));
}

/**
 * Computes the next state of a card after a rating.
 *
 * @param {object} card   { state, step, ease, intervalDays, reps, lapses }
 * @param {number} rating 1..4
 * @param {Date}   now
 * @param {object} options { fuzzing: boolean }
 * @returns {object} the updated card fields plus `delayMinutes`
 */
export function schedule(card, rating, now = new Date(), options = {}) {
  const useFuzz = options.fuzzing !== false;
  const next = {
    state: card.state,
    step: card.step,
    ease: card.ease,
    intervalDays: card.intervalDays,
    reps: card.reps + 1,
    lapses: card.lapses,
  };
  let delayMinutes = 0;

  if (card.state === 'new' || card.state === 'learning') {
    const steps = CONFIG.learningSteps;
    if (rating === 1) {
      next.state = 'learning';
      next.step = 0;
      delayMinutes = steps[0];
    } else if (rating === 2) {
      next.state = 'learning';
      delayMinutes = hardLearningDelay(card.step);
    } else if (rating === 3) {
      const isLastStep = card.state === 'new' ? steps.length === 1 : card.step >= steps.length - 1;
      if (isLastStep) {
        next.state = 'review';
        next.step = 0;
        next.intervalDays = CONFIG.graduatingIntervalDays;
        delayMinutes = next.intervalDays * 24 * 60;
      } else {
        next.state = 'learning';
        next.step = card.state === 'new' ? 1 : card.step + 1;
        delayMinutes = steps[next.step];
      }
    } else {
      next.state = 'review';
      next.step = 0;
      next.intervalDays = CONFIG.easyIntervalDays;
      delayMinutes = next.intervalDays * 24 * 60;
    }
  } else if (card.state === 'review') {
    const ivl = card.intervalDays;
    if (rating === 1) {
      next.state = 'relearning';
      next.step = 0;
      next.lapses = card.lapses + 1;
      next.ease = Math.max(CONFIG.minEase, card.ease - 0.2);
      next.intervalDays = Math.max(1, ivl * CONFIG.lapseNewInterval);
      delayMinutes = CONFIG.relearningSteps[0];
    } else {
      let newIvl;
      if (rating === 2) {
        next.ease = Math.max(CONFIG.minEase, card.ease - 0.15);
        newIvl = Math.max(ivl + 1, ivl * CONFIG.hardMultiplier);
      } else if (rating === 3) {
        newIvl = Math.max(ivl + 1, ivl * card.ease);
      } else {
        next.ease = card.ease + 0.15;
        newIvl = Math.max(ivl + 1, ivl * card.ease * CONFIG.easyBonus);
      }
      next.intervalDays = useFuzz ? fuzz(newIvl) : newIvl;
      delayMinutes = next.intervalDays * 24 * 60;
    }
  } else {
    // relearning
    if (rating === 1) {
      next.step = 0;
      delayMinutes = CONFIG.relearningSteps[0];
    } else if (rating === 2) {
      delayMinutes = CONFIG.relearningSteps[0];
    } else {
      next.state = 'review';
      next.step = 0;
      next.intervalDays = Math.max(1, card.intervalDays);
      if (rating === 4) next.intervalDays += 1; // Easy: one extra day
      delayMinutes = next.intervalDays * 24 * 60;
    }
  }

  next.due = new Date(now.getTime() + delayMinutes * MINUTE);
  next.lastReviewedAt = now;
  next.delayMinutes = delayMinutes;
  return next;
}

/** The delay in minutes each rating would produce, used for the button labels. */
export function previewDelays(card) {
  return [1, 2, 3, 4].map((rating) => schedule(card, rating, new Date(0), { fuzzing: false }).delayMinutes);
}

/**
 * Builds the study queue in Anki order:
 *   1. learning / relearning cards that are due
 *   2. review cards that are due
 *   3. new cards, limited by what is left of today's daily allowance
 *
 * @param {Array}  cards         all cards of one collection
 * @param {Date}   now
 * @param {number} newDoneToday  how many new cards were already started today
 */
export function buildQueue(cards, now = new Date(), newDoneToday = 0) {
  const t = now.getTime();
  const byDue = (a, b) => new Date(a.due) - new Date(b.due);

  const learning = cards
    .filter((c) => (c.state === 'learning' || c.state === 'relearning') && new Date(c.due).getTime() <= t)
    .sort(byDue);
  const reviews = cards.filter((c) => c.state === 'review' && new Date(c.due).getTime() <= t).sort(byDue);
  const allowance = Math.max(0, CONFIG.newPerDay - newDoneToday);
  const fresh = cards.filter((c) => c.state === 'new').slice(0, allowance);

  return [...learning, ...reviews, ...fresh];
}
