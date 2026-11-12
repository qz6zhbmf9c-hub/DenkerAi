// Shared UI helpers: mascot sprite, top bar, loading overlay, page guards.
import { api } from './api.js';

// The mascot is defined once and reused with <use href="#mascot">.
// The eyes carry a class so the blink animation in style.css can target them.
const SPRITE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <g id="mascot">
      <line x1="60" y1="14" x2="60" y2="28" stroke="#9CF04F" stroke-width="5" stroke-linecap="round"/>
      <circle cx="60" cy="12" r="8" fill="#FFD84D"/>
      <ellipse cx="60" cy="72" rx="46" ry="42" fill="#58CC02"/>
      <ellipse cx="60" cy="86" rx="30" ry="22" fill="#9CF04F" opacity=".55"/>
      <circle class="mascot-eye" cx="43" cy="62" r="13" fill="#fff"/>
      <circle class="mascot-eye" cx="77" cy="62" r="13" fill="#fff"/>
      <circle cx="45" cy="63" r="6" fill="#0A1730"/><circle cx="79" cy="63" r="6" fill="#0A1730"/>
      <path d="M48 86 Q60 98 72 86" stroke="#0A1730" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
  </defs>
</svg>`;
document.body.insertAdjacentHTML('afterbegin', SPRITE);

/** Creates an element safely. Text always goes through textContent. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

/** Fills the top bar: Log in button, or level chip plus initial avatar. */
export function renderTopbar(user) {
  const bar = document.getElementById('topbar');
  const home = user ? '/app.html' : '/';
  bar.replaceChildren(el('a', { class: 'logo', href: home, 'aria-label': 'DenkerAI home' }, ['Denker', el('span', { text: 'AI' })]));
  const right = el('div', { class: 'topbar-right' });
  if (user) {
    if (user.level) right.append(el('span', { class: 'chip', text: user.level }));
    right.append(
      el('button', {
        class: 'avatar', type: 'button', title: 'Log out', 'aria-label': 'Log out',
        text: user.name.charAt(0).toUpperCase(),
        onclick: async () => {
          await api.post('/api/auth/logout').catch(() => {});
          location.href = '/';
        },
      })
    );
  } else {
    right.append(el('a', { class: 'btn-ghost', href: '/login.html', text: 'Log in' }));
  }
  bar.append(right);
}

export function showLoading(text) {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-modal').classList.add('active');
}
export const hideLoading = () => document.getElementById('loading-modal').classList.remove('active');

/** Shows (or clears) an error message in an element. */
export function setError(id, message = '') {
  document.getElementById(id).textContent = message;
}

/** Where a logged-in user should go next. */
export const nextPage = (user) => (user.level ? '/app.html' : '/level.html');

/** Returns the current user, or null when logged out. */
export async function fetchUser() {
  try {
    return (await api.get('/api/me')).user;
  } catch {
    return null;
  }
}

/** Guard for protected pages: redirects to login when there is no session. */
export async function requireUser() {
  const user = await fetchUser();
  if (!user) {
    location.replace('/login.html');
    return new Promise(() => {}); // never resolves: the page is leaving
  }
  renderTopbar(user);
  return user;
}

/** Turns a delay in minutes into a short label such as "10 min" or "4 days". */
export function formatDelay(minutes) {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  const days = minutes / 1440;
  if (days < 30) return `${Math.round(days)} ${Math.round(days) === 1 ? 'day' : 'days'}`;
  return `${(days / 30).toFixed(1).replace('.0', '')} mo`;
}

// The privacy page has no script of its own, so it just needs the top bar.
if (location.pathname.endsWith('privacy.html')) fetchUser().then(renderTopbar);
