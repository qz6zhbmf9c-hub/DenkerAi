// level.html: choose A1 to C1, or ask for the quick test.
import { api } from './api.js';
import { el, requireUser, setError } from './ui.js';

await requireUser();

const LEVELS = [
  { id: 'A1', label: 'Complete beginner' },
  { id: 'A2', label: 'I know basic phrases' },
  { id: 'B1', label: 'I can hold simple conversations' },
  { id: 'B2', label: 'I speak fairly well' },
  { id: 'C1', label: 'Advanced' },
  { id: 'TEST', label: 'I am not sure, test me' },
];

const list = document.getElementById('level-options');
const button = document.getElementById('btn-continue');
let selected = null;

for (const level of LEVELS) {
  const option = el('button', { class: 'level-card', type: 'button', role: 'radio', 'aria-checked': 'false' }, [
    el('span', { class: 'code', text: level.id === 'TEST' ? '?' : level.id }),
    el('span', { text: level.label }),
  ]);
  option.addEventListener('click', () => {
    selected = level.id;
    for (const node of list.children) {
      node.classList.remove('selected');
      node.setAttribute('aria-checked', 'false');
    }
    option.classList.add('selected');
    option.setAttribute('aria-checked', 'true');
    button.disabled = false;
  });
  list.append(option);
}

button.addEventListener('click', async () => {
  if (selected === 'TEST') return (location.href = '/test.html');
  button.disabled = true;
  try {
    await api.post('/api/level/set', { level: selected });
    location.href = '/app.html';
  } catch (err) {
    setError('err-level', err.message);
    button.disabled = false;
  }
});
