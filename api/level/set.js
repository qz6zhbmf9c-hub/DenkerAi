// POST /api/level/set  { level: "A1".."C1" }  (level chosen by the user)
import { prisma } from '../_lib/db.js';
import { LEVELS, allowMethods, json, withUser } from '../_lib/auth.js';

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const level = req.body?.level;
  if (!LEVELS.includes(level)) return json(res, 400, { error: 'Unknown level.' });
  await prisma.user.update({ where: { id: user.id }, data: { level, levelSource: 'chosen' } });
  json(res, 200, { level });
});
