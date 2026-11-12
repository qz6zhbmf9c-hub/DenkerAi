// Sign-up (index.html) and log-in (login.html) forms.
import { api } from './api.js';
import { fetchUser, nextPage, renderTopbar, setError } from './ui.js';

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');

// Already logged in? Skip the welcome and login pages.
const user = await fetchUser();
if (user) location.replace(nextPage(user));
else renderTopbar(null);

if (signupForm) {
  document.getElementById('btn-get-started').addEventListener('click', () => {
    document.getElementById('signup-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('name').focus(), 400);
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    for (const id of ['name', 'email', 'password', 'privacy']) setError('err-' + id);
    const button = document.getElementById('btn-signup');
    button.disabled = true;
    try {
      await api.post('/api/auth/signup', {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        acceptedPrivacy: document.getElementById('privacy').checked,
      });
      location.href = '/level.html';
    } catch (err) {
      setError('err-' + (err.field || 'password'), err.message);
      button.disabled = false;
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('err-login');
    const button = document.getElementById('btn-login');
    button.disabled = true;
    try {
      const { user: u } = await api.post('/api/auth/login', {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      });
      location.href = nextPage(u);
    } catch (err) {
      setError('err-login', err.message);
      button.disabled = false;
    }
  });
}
