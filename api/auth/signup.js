// POST /api/auth/signup  { name, email, password, acceptedPrivacy }
import { prisma } from '../_lib/db.js';
import { allowMethods, cleanString, hashPassword, json, safe, setSessionCookie, signSession } from '../_lib/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default safe(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const body = req.body || {};
  const name = cleanString(body.name, 60);
  const email = cleanString(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (name.length < 2) return json(res, 400, { error: 'Please enter your name.', field: 'name' });
  if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'Please enter a valid email.', field: 'email' });
  if (password.length < 8 || password.length > 128)
    return json(res, 400, { error: 'Password must be 8 to 128 characters.', field: 'password' });
  if (body.acceptedPrivacy !== true)
    return json(res, 400, { error: 'Please accept the privacy policy.', field: 'privacy' });

  if (await prisma.user.findUnique({ where: { email } }))
    return json(res, 409, { error: 'This email already has an account.', field: 'email' });

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), privacyAcceptedAt: new Date() },
  });
  setSessionCookie(res, await signSession(user.id));
  json(res, 201, { user: { id: user.id, name: user.name, email: user.email, level: null } });
});
