// app.html: first-collection screen (no collections yet) and the dashboard.
import { api } from './api.js';
import { el, hideLoading, requireUser, setError, showLoading } from './ui.js';

const user = await requireUser();
if (!user.level) location.replace('/level.html');

const emptyView = document.getElementById('view-empty');
const dashView = document.getElementById('view-dashboard');
const modal = document.getElementById('new-modal');

/** Creates a collection from a prompt, then reloads the dashboard. */
async function createCollection(prompt, errorId) {
  const text = prompt.trim();
  if (text.length < 2) return;
  setError('err-empty');
  modal.classList.remove('active');
  showLoading('Denki is writing your cards...');
  try {
    await api.post('/api/collections', { prompt: text });
    await load();
  } catch (err) {
    setError(errorId, err.message);
    emptyView.hidden = false;
  } finally {
    hideLoading();
  }
}

function openModal() {
  modal.classList.add('active');
  document.getElementById('prompt-modal').focus();
}

function collectionCard(c) {
  const pct = c.total ? Math.round((c.learned / c.total) * 100) : 0;
  const track = el('div', { class: 'progress-track' }, [el('div', { class: 'progress-fill' })]);
  requestAnimationFrame(() => (track.firstChild.style.width = pct + '%')); // animates the fill
  return el('div', { class: 'glass-panel collection-card' }, [
    el('div', { class: 'head' }, [
      el('div', { class: 'w900 text-18', text: c.title }),
      el('span', { class: 'chip', text: c.level }),
    ]),
    el('div', { class: 'text-14 text-muted', text: `${c.total} cards · ${c.due} due` }),
    track,
    el('div', { class: 'foot' }, [
      el('div', { class: 'w800', text: `${pct}% learned` }),
      el('a', { class: 'btn-primary small', href: `/practice.html?collectionId=${encodeURIComponent(c.id)}`, text: c.due > 0 ? 'Review' : 'Practice' }),
    ]),
  ]);
}

async function load() {
  const [{ collections }, stats] = await Promise.all([api.get('/api/collections'), api.get('/api/stats')]);
  const hasCollections = collections.length > 0;
  emptyView.hidden = hasCollections;
  dashView.hidden = !hasCollections;
  document.getElementById('dash-mascot').hidden = !hasCollections;
  document.getElementById('welcome-title').textContent = `Hallo, ${user.name.split(' ')[0]}!`;
  if (!hasCollections) return;

  document.getElementById('stat-due').textContent = `${stats.dueToday} ${stats.dueToday === 1 ? 'card' : 'cards'}`;
  document.getElementById('stat-progress').textContent = `${stats.progress}%`;
  document.getElementById('stat-words').textContent = stats.wordsLearned;

  const plus = el('button', { class: 'glass-panel collection-card plus-card', type: 'button', onclick: openModal }, [
    el('span', { class: 'plus-badge', 'aria-hidden': 'true', text: '+' }),
    el('span', { text: 'New collection' }),
  ]);
  document.getElementById('collection-grid').replaceChildren(...collections.map(collectionCard), plus);
}

document.getElementById('empty-form').addEventListener('submit', (e) => {
  e.preventDefault();
  createCollection(document.getElementById('prompt-empty').value, 'err-empty');
});
document.getElementById('modal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('prompt-modal');
  const value = input.value;
  input.value = '';
  createCollection(value, 'err-empty');
});
document.getElementById('btn-cancel-new').addEventListener('click', () => modal.classList.remove('active'));
document.addEventListener('keydown', (e) => e.key === 'Escape' && modal.classList.remove('active'));
document.getElementById('suggestions').addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  const input = document.getElementById('prompt-empty');
  input.value = e.target.textContent;
  input.focus();
});

await load();
