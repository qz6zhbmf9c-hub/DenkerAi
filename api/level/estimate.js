// POST /api/level/estimate  { answers: [index | -1, ...12] }
// The server grades the answers itself, then asks the AI for a CEFR estimate.
// If the AI is unavailable, a simple rule-based estimate is used instead.
import { prisma } from '../_lib/db.js';
import { LEVELS, allowMethods, json, withUser } from '../_lib/auth.js';
import { LEVEL_BANK } from '../_lib/levelBank.js';
import { estimateLevel } from '../_lib/ai.js';

/** Highest level where the learner got at least 2 of 3 questions right (A1 as floor). */
function fallbackLevel(graded) {
  let result = 'A1';
  for (const lvl of LEVELS) {
    const items = graded.filter((g) => g.level === lvl);
    if (items.length && items.filter((g) => g.result === 'correct').length >= 2) result = lvl;
    else if (items.length) break;
  }
  return result;
}

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== LEVEL_BANK.length)
    return json(res, 400, { error: 'Please answer all questions.' });

  const graded = LEVEL_BANK.map((item, i) => {
    const a = answers[i];
    const result = a === item.answer ? 'correct' : a === -1 ? 'skipped' : 'wrong';
    return { level: item.level, question: item.q, result };
  });

  let level;
  let reason;
  try {
    const est = await estimateLevel(graded);
    if (!LEVELS.includes(est.level)) throw new Error('Bad level from AI');
    ({ level, reason } = est);
  } catch (err) {
    console.error(err);
    level = fallbackLevel(graded);
    reason = 'Estimated from how many questions you got right at each level.';
  }

  await prisma.user.update({ where: { id: user.id }, data: { level, levelSource: 'test' } });
  json(res, 200, { level, reason });
});
