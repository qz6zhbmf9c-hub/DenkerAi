// POST /api/auth/login  { email, password }
import { prisma } from '../_lib/db.js';
import { allowMethods, cleanString, json, safe, setSessionCookie, signSession, verifyPassword } from '../_lib/auth.js';

export default safe(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const email = cleanString(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  // Same message for unknown email and wrong password, so emails cannot be probed.
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return json(res, 401, { error: 'Email or password is wrong.' });

  setSessionCookie(res, await signSession(user.id));
  json(res, 200, { user: { id: user.id, name: user.name, email: user.email, level: user.level } });
});
