export function renderHome({ library, show, heading, fallback, open }) {
  let section = document.getElementById('discovery-playlists');
  if (!section) {
    section = document.createElement('section');
    section.id = 'discovery-playlists';
    heading.before(section);
  }
  const lists = library.get().playlists.slice(0, 4);
  section.hidden = !show || !lists.length;
  if (section.hidden) return;
  const title = document.createElement('h2');
  title.textContent = 'your playlists';
  const row = document.createElement('div');
  row.className = 'playlist-shortcuts';
  for (const list of lists) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'playlist-shortcut';
    const art = document.createElement('span');
    art.className = 'playlist-shortcut-art';
    const tracks = list.tracks.length >= 4 ? list.tracks.slice(0, 4) : list.tracks.slice(0, 1);
    art.classList.toggle('is-collage', tracks.length === 4);
    if (!tracks.length) art.textContent = list.name.trim().slice(0, 1).toUpperCase() || '♪';
    for (const track of tracks) {
      const image = document.createElement('img');
      image.alt = '';
      image.src = track.cover || '/png/logo.png';
      fallback(image);
      art.append(image);
    }
    const name = document.createElement('strong');
    name.className = 'playlist-shortcut-name';
    name.textContent = list.name;
    button.append(art, name);
    button.onclick = () => open(list.id);
    row.append(button);
  }
  section.replaceChildren(title, row);
}
