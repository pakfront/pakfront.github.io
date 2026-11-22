import {project, newProject, editProject, replaceProject, changes, storageMessage, previous, undoProject} from './project.js';

const $ = id => document.getElementById(id);
const modules = {};
let view;
let navigation = 0;
function notice(message) {
  $('project-notice').textContent = message;
  $('project-notice').hidden = !message;
}
async function show(next) {
  const ticket = ++navigation;
  view = next;
  $('save').disabled = false;
  const army = next === 'army';
  $('army-view').hidden = !army;
  $('paper-view').hidden = army;
  $('paper-style').disabled = army;
  $('roster-style').disabled = !army;
  for (const name of ['army', 'paper', 'manual'])
    $(name + '-nav').setAttribute('aria-current', next === name ? 'page' : 'false');
  const mode = next === 'manual' ? 'manual' : 'roster';
  if (project.mode !== mode) editProject(p => { p.mode = mode; }, 'navigation');
  history.replaceState(null, '', '#' + next);
  const name = army ? 'army' : 'paper';
  modules[name] ??= army ? import('./roster/app.js') : import('./app.js');
  const module = await modules[name];
  if (ticket === navigation) module.renderView();
}
for (const name of ['army', 'paper', 'manual'])
  $(name + '-nav').onclick = () => show(name);
const home = () => project.mode === 'manual' ? 'manual' : 'army';
changes.addEventListener('change', event => {
  $('undo').disabled = !previous;
  notice(storageMessage);
  if (['load','new','undo'].includes(event.detail)) {
    const compatible = (view === 'manual') === (project.mode === 'manual');
    show(compatible && event.detail === 'undo' ? view : home());
  }
});
$('undo').onclick = undoProject;
$('new-project').onclick = () => {
  if (confirm('Start a fresh project? You can undo this change.')) replaceProject(newProject(project.mode), 'new');
};
$('save').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = (project.army.name.replace(/[^a-z0-9_-]+/gi, '-') || 'midgard') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
$('load').onclick = () => $('load-file').click();
$('load-file').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    replaceProject(JSON.parse(await file.text()), 'load');
    notice(storageMessage || 'Loaded ' + file.name);
  } catch (error) { notice('Could not open project: ' + error.message); }
  finally { event.target.value = ''; }
};
$('undo').disabled = !previous;
notice(storageMessage);
const hash = location.hash.slice(1);
show(['manual','paper','army'].includes(hash) ? hash : home());
