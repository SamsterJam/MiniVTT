// public/js/settingsManager.js
//
// Every setting, once. The dialog is drawn from this table, and a switch shows
// what the server sent back rather than what was clicked.
//
//   group  the heading it sits under, in this order
//   key    the setting on the server
//   label  what it is called
//   hint   what turning it on does

const SETTINGS = [
  {
    group: 'Player announcements',
    key: 'announceMusic',
    label: 'Music',
    hint: 'Names each track as it starts.',
  },
  {
    group: 'Player announcements',
    key: 'announceScene',
    label: 'Scenes',
    hint: 'Names each scene as it opens.',
  },
];

export class SettingsManager {
  constructor(socket) {
    this.socket = socket;
    this.rows = new Map(); // key -> row

    this.build(document.getElementById('setting-groups'));
    this.socket.on('settings', (settings) => this.render(settings));
  }

  build(container) {
    const groups = new Map();
    for (const setting of SETTINGS) {
      if (!groups.has(setting.group)) groups.set(setting.group, []);
      groups.get(setting.group).push(setting);
    }

    container.replaceChildren(
      ...[...groups].map(([name, settings]) => {
        const group = document.createElement('div');
        group.className = 'setting-group';

        const heading = document.createElement('h3');
        heading.textContent = name;
        group.append(heading);

        for (const setting of settings) group.append(this.buildRow(setting));
        return group;
      })
    );
  }

  /** The whole row is the switch, so the label and the hint are targets too. */
  buildRow({ key, label, hint }) {
    const row = document.createElement('button');
    row.type = 'button'; // it sits in a form that would otherwise close the dialog
    row.className = 'setting';
    row.setAttribute('role', 'switch');
    row.setAttribute('aria-checked', 'false');

    const name = document.createElement('span');
    name.className = 'setting-label';
    name.textContent = label;

    const description = document.createElement('span');
    description.className = 'setting-hint';
    description.textContent = hint;

    const text = document.createElement('span');
    text.className = 'setting-text';
    text.append(name, description);

    const control = document.createElement('span');
    control.className = 'switch';

    row.append(text, control);
    row.addEventListener('click', () => {
      const value = row.getAttribute('aria-checked') !== 'true';
      this.socket.emit('setSetting', { key, value });
    });

    this.rows.set(key, row);
    return row;
  }

  render(settings) {
    for (const [key, row] of this.rows) {
      row.setAttribute('aria-checked', String(Boolean(settings[key])));
    }
  }
}
