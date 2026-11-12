// DELETE /api/collections/:id  (cards and review logs are removed by cascade)
import { prisma } from '../_lib/db.js';
import { allowMethods, json, withUser } from '../_lib/auth.js';

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['DELETE'])) return;
  const id = String(req.query.id || '');
  // deleteMany with userId ensures nobody can delete another user's collection.
  const result = await prisma.collection.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return json(res, 404, { error: 'Collection not found.' });
  json(res, 200, { ok: true });
});
