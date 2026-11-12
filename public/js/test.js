// test.html: 12 questions, then the server grades them and the AI estimates the level.
import { api } from './api.js';
import { el, hideLoading, requireUser, showLoading } from './ui.js';

await requireUser();

const { questions } = await api.get('/api/level/questions');
const answers = [];
let index = 0;
let chosen = null;

const sentence = document.getElementById('sentence');
const options = document.getElementById('options');
const next = document.getElementById('btn-next');

function render() {
  const q = questions[index];
  const pct = Math.round((index / questions.length) * 100);
  document.getElementById('progress-text').textContent = `Question ${index + 1} of ${questions.length}`;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-bar').style.width = `${pct}%`;
  document.getElementById('progress-track').setAttribute('aria-valuenow', pct);

  sentence.textContent = q.q;
  options.replaceChildren(
    ...q.options.map((text, i) => {
      const option = el('button', { class: 'level-card', type: 'button', role: 'radio', 'aria-checked': 'false', text });
      option.addEventListener('click', () => choose(i));
      return option;
    })
  );
  chosen = null;
  next.disabled = true;
  next.textContent = index === questions.length - 1 ? 'Finish' : 'Next';
}

function choose(i) {
  chosen = i;
  [...options.children].forEach((node, n) => {
    node.classList.toggle('selected', n === i);
    node.setAttribute('aria-checked', String(n === i));
  });
  next.disabled = false;
}

async function submit(value) {
  answers.push(value); // -1 means skipped
  if (index < questions.length - 1) {
    index += 1;
    return render();
  }
  showLoading('Denki is checking your answers...');
  try {
    const result = await api.post('/api/level/estimate', { answers });
    hideLoading();
    document.getElementById('result-level').textContent = result.level;
    document.getElementById('result-reason').textContent = result.reason;
    document.getElementById('result-modal').classList.add('active');
    document.getElementById('btn-lets-go').focus();
  } catch (err) {
    hideLoading();
    alert(err.message);
  }
}

next.addEventListener('click', () => chosen !== null && submit(chosen));
document.getElementById('btn-skip').addEventListener('click', () => submit(-1));

// Keyboard: 1-4 select an answer, Enter continues.
document.addEventListener('keydown', (event) => {
  if (document.getElementById('result-modal').classList.contains('active')) return;
  if (['1', '2', '3', '4'].includes(event.key)) choose(Number(event.key) - 1);
  else if (event.key === 'Enter' && chosen !== null && document.activeElement.tagName !== 'BUTTON') submit(chosen);
});

render();
