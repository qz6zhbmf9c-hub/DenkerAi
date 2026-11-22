// practice.html: one flashcard at a time, Anki-style rating buttons (keys 1-4).
// The German word is read aloud automatically each time a card appears.
import { api } from './api.js';
import { formatDelay, requireUser } from './ui.js';

await requireUser();

const collectionId = new URLSearchParams(location.search).get('collectionId');
if (!collectionId) location.replace('/app.html');

const $ = (id) => document.getElementById(id);
let queue = [];
let done = 0;
let current = null;
let answerShown = false;
let busy = false;
let spokenId = null; // id of the card whose audio has actually started

function updateCounters() {
  const count = (fn) => queue.filter(fn).length;
  $('cnt-new').textContent = count((c) => c.state === 'new');
  $('cnt-learn').textContent = count((c) => c.state === 'learning' || c.state === 'relearning');
  $('cnt-review').textContent = count((c) => c.state === 'review');
  const total = done + queue.length;
  const pct = total ? Math.round((done / total) * 100) : 100;
  $('count-text').textContent = `${done} of ${total}`;
  $('session-bar').style.width = pct + '%';
  $('session-track').setAttribute('aria-valuenow', pct);
}

function showCard() {
  updateCounters();
  if (queue.length === 0) {
    $('flashcard').hidden = true;
    $('counters').hidden = true;
    $('done').hidden = false;
    return;
  }
  current = queue[0];
  answerShown = false;
  const type = [current.partOfSpeech, current.gender].filter(Boolean).join(' · ');
  $('card-type').textContent = type.charAt(0).toUpperCase() + type.slice(1);
  $('card-german').textContent = current.german;
  $('card-english').textContent = current.english;
  $('card-example-de').textContent = current.exampleDe;
  $('card-example-en').textContent = current.exampleEn;
  $('answer').hidden = true;
  $('rating').hidden = true;
  $('show-wrap').hidden = false;
  $('flashcard').hidden = false;
  $('btn-show').focus();
  speak();
}

function showAnswer() {
  if (!current || answerShown) return;
  answerShown = true;
  $('answer').hidden = false;
  $('show-wrap').hidden = true;
  current.delays.forEach((minutes, i) => ($('lbl-' + (i + 1)).textContent = formatDelay(minutes)));
  $('rating').hidden = false;
}

async function rate(rating) {
  if (!answerShown || busy) return;
  busy = true;
  try {
    const { card } = await api.post('/api/review', { cardId: current.id, rating });
    queue.shift();
    done += 1;
    // A card still in learning that is due within 20 minutes comes back this session.
    if ((card.state === 'learning' || card.state === 'relearning') && card.delayMinutes <= 20) {
      queue.push({ ...current, state: card.state, delays: card.delays });
    }
    showCard();
  } catch (err) {
    alert(err.message);
  } finally {
    busy = false;
  }
}

function speak() {
  if (!current || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const card = current;
  const utterance = new SpeechSynthesisUtterance(card.german);
  utterance.lang = 'de-DE';
  utterance.onstart = () => (spokenId = card.id);
  speechSynthesis.speak(utterance);
}

// Browsers only allow sound after the user has interacted with the page. If the first card
// could not play on its own, it plays on the first tap or key press instead; after that every
// card is read automatically.
function playIfBlocked(e) {
  if (!current || spokenId === current.id || e.target.closest?.('#btn-speak')) return;
  speak();
}
document.addEventListener('pointerdown', playIfBlocked, { capture: true });
document.addEventListener('keydown', playIfBlocked, { capture: true });
window.addEventListener('pagehide', () => 'speechSynthesis' in window && speechSynthesis.cancel());

$('btn-show').addEventListener('click', showAnswer);
$('btn-speak').addEventListener('click', speak);
$('rating').addEventListener('click', (e) => {
  const button = e.target.closest('[data-rating]');
  if (button) rate(Number(button.dataset.rating));
});
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    if (!answerShown && current && document.activeElement.tagName !== 'A') {
      e.preventDefault();
      showAnswer();
    }
  } else if (['1', '2', '3', '4'].includes(e.key)) rate(Number(e.key));
});

try {
  const data = await api.get(`/api/study?collectionId=${encodeURIComponent(collectionId)}`);
  $('col-title').textContent = data.collection.title;
  $('col-level').textContent = data.collection.level;
  queue = data.cards;
  showCard();
} catch {
  location.replace('/app.html');
}
