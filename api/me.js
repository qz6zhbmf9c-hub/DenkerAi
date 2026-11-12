// GET /api/me  -> the logged-in user, or 401. Every protected page calls this.
import { allowMethods, json, withUser } from './_lib/auth.js';

export default withUser(async (req, res, user) => {
  if (!allowMethods(req, res, ['GET'])) return;
  json(res, 200, { user });
});
