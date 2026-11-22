// app.html: first-collection screen (no collections yet) and the dashboard.
import { api } from './api.js';
import { el, hideLoading, requireUser, setError, showLoading } from './ui.js';

const user = await requireUser();
if (!user.level) location.replace('/level.html');

const emptyView = document.getElementById('view-empty');
const dashView = document.getElementById('view-dashboard');

/** First-collection screen: creates a collection from a topic, then reloads the dashboard. */
async function createFromTopic(prompt) {
  const text = prompt.trim();
  if (text.length < 2) return;
  setError('err-empty');
  showLoading('Denki is writing your cards...');
  try {
    await api.post('/api/collections', { prompt: text });
    await load();
  } catch (err) {
    setError('err-empty', err.message);
  } finally {
    hideLoading();
  }
}

// ---------- New collection window: photos or typed words ----------

const MAX_PHOTOS = 5;      // the AI reads at most 5 images per request
const MAX_WORDS = 30;      // keep in sync with api/collections/index.js
const MAX_SIDE = 1280;     // photos are shrunk in the browser so the upload stays small
const MAX_CHARS = 700_000; // per photo, as base64 (the server accepts up to 1,000,000)

// Phones and tablets get a "Take photo" button. iPadOS reports itself as a Mac, so check touch points too.
const hasCamera = navigator.maxTouchPoints > 1 || matchMedia('(pointer: coarse)').matches;

const $ = (id) => document.getElementById(id);
let tab = 'topic';
let photos = []; // [{ id, url }]  url is a JPEG data URL
let pending = 0; // photos still being shrunk
let photoSeq = 0;

function parseWords() {
  const raw = $('words-text').value.split('\n').map((w) => w.trim()).filter(Boolean);
  // One single line such as "apple, banana, cat" is treated as a comma separated list.
  const parts = raw.length === 1 ? raw[0].split(/[,;]/).map((w) => w.trim()).filter(Boolean) : raw;
  const seen = new Set();
  return parts.filter((w) => !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()));
}

function refreshNewForm() {
  const words = parseWords();
  $('words-count').textContent = words.length === 0 ? '' : words.length > MAX_WORDS
    ? `${words.length} words. Only the first ${MAX_WORDS} will be used.`
    : `${words.length} ${words.length === 1 ? 'word' : 'words'}`;
  $('photo-count').textContent = `${photos.length} of ${MAX_PHOTOS} photos`;
  $('btn-camera').disabled = $('btn-files').disabled = photos.length >= MAX_PHOTOS;
  const topicOk = $('prompt-modal').value.trim().length >= 2;
  $('btn-topic-go').disabled = !topicOk;
  $('btn-create').hidden = tab === 'topic'; // the topic bar has its own arrow button
  $('btn-create').disabled = tab === 'photos' ? photos.length === 0 || pending > 0 : words.length === 0;
}

function renderThumbs() {
  $('thumbs').replaceChildren(...photos.map((p) => el('div', { class: 'thumb' }, [
    el('img', { src: p.url, alt: 'Selected photo' }),
    el('button', {
      type: 'button', 'aria-label': 'Remove photo', text: '\u2715',
      onclick: () => { photos = photos.filter((x) => x.id !== p.id); renderThumbs(); refreshNewForm(); },
    }),
  ])));
}

function setTab(name) {
  tab = name;
  for (const t of ['topic', 'photos', 'words']) {
    $('tab-' + t).classList.toggle('active', t === name);
    $('tab-' + t).setAttribute('aria-selected', String(t === name));
    $('panel-' + t).hidden = t !== name;
  }
  setError('new-error');
  refreshNewForm();
}

/** Reads a picture file and returns a small JPEG data URL. */
async function toJpegDataUrl(file) {
  let source;
  try {
    source = await createImageBitmap(file); // also applies the photo's rotation
  } catch {
    source = await new Promise((resolve, reject) => { // fallback for browsers that cannot decode it directly
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('decode'));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // Try smaller sizes and lower quality until the photo fits the size limit.
  for (const [scale, quality] of [[1, 0.8], [0.8, 0.7], [0.6, 0.6], [0.45, 0.5]]) {
    const ratio = Math.min(1, MAX_SIDE / Math.max(width, height)) * scale;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    ctx.fillStyle = '#fff'; // transparent PNGs would turn black in a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error('too big');
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (files.length === 0) return setError('new-error', 'Please choose pictures (photos or screenshots).');
  setError('new-error');
  const room = MAX_PHOTOS - photos.length - pending;
  if (files.length > room) setError('new-error', `You can add up to ${MAX_PHOTOS} photos at once.`);
  for (const file of files.slice(0, Math.max(0, room))) {
    pending += 1;
    refreshNewForm();
    try {
      photos.push({ id: ++photoSeq, url: await toJpegDataUrl(file) });
    } catch {
      setError('new-error', `"${file.name}" could not be used. Try another picture.`);
    } finally {
      pending -= 1;
    }
    renderThumbs();
    refreshNewForm();
  }
}

function openModal() {
  setError('new-error');
  setTab(tab);
  $('new-modal').classList.add('active');
  ({ topic: $('prompt-modal'), words: $('words-text'), photos: $('btn-files') })[tab].focus();
}
const closeModal = () => $('new-modal').classList.remove('active');

function resetNewForm() {
  photos = [];
  $('prompt-modal').value = '';
  $('words-text').value = '';
  $('words-title').value = '';
  renderThumbs();
  refreshNewForm();
}

async function createFromModal() {
  const bodies = {
    topic: { prompt: $('prompt-modal').value.trim() },
    photos: { mode: 'photos', images: photos.map((p) => p.url) },
    words: { mode: 'words', words: parseWords().slice(0, MAX_WORDS), title: $('words-title').value },
  };
  const body = bodies[tab];
  closeModal();
  showLoading(tab === 'photos' ? 'Denki is reading your photos...' : 'Denki is writing your cards...');
  try {
    await api.post('/api/collections', body);
    resetNewForm();
    await load();
  } catch (err) {
    openModal(); // keep what the user entered and show what went wrong
    setError('new-error', err.message);
  } finally {
    hideLoading();
  }
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
  createFromTopic(document.getElementById('prompt-empty').value);
});
document.getElementById('suggestions').addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  const input = document.getElementById('prompt-empty');
  input.value = e.target.textContent;
  input.focus();
});
$('btn-own-empty').addEventListener('click', openModal);

// New collection window
$('tab-topic').addEventListener('click', () => setTab('topic'));
$('tab-photos').addEventListener('click', () => setTab('photos'));
$('tab-words').addEventListener('click', () => setTab('words'));
$('btn-cancel-new').addEventListener('click', closeModal);
$('btn-cancel-new-2').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
$('btn-create').addEventListener('click', createFromModal);
$('btn-topic-go').addEventListener('click', createFromModal);
$('prompt-modal').addEventListener('input', refreshNewForm);
$('prompt-modal').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !$('btn-topic-go').disabled) createFromModal();
});
$('words-text').addEventListener('input', refreshNewForm);

$('btn-camera').hidden = !hasCamera;
if (hasCamera) $('files-label').textContent = 'Photos & files';
$('btn-camera').addEventListener('click', () => $('input-camera').click());
$('btn-files').addEventListener('click', () => $('input-files').click());
for (const id of ['input-camera', 'input-files']) {
  $(id).addEventListener('change', (e) => {
    addFiles(e.target.files);
    e.target.value = ''; // lets the same picture be chosen again
  });
}
const zone = $('drop-zone');
zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('over'));
zone.addEventListener('drop', (e) => {
  e.preventDefault();
  zone.classList.remove('over');
  addFiles(e.dataTransfer.files);
});
refreshNewForm();

await load();
