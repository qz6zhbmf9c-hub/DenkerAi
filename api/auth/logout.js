// POST /api/auth/logout
import { allowMethods, clearSessionCookie, json, safe } from '../_lib/auth.js';

export default safe(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  clearSessionCookie(res);
  json(res, 200, { ok: true });
});
