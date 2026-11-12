// GET /api/level/questions -> the 12 test questions WITHOUT the answers.
import { allowMethods, json, withUser } from '../_lib/auth.js';
import { LEVEL_BANK } from '../_lib/levelBank.js';

export default withUser(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  json(res, 200, { questions: LEVEL_BANK.map(({ q, options }) => ({ q, options })) });
});
