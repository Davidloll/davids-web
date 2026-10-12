(() => {
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const watched = new WeakSet();
  let labels = {};
  let pending = false;
  const skip = 'script, style, textarea, input, [contenteditable], [data-i18n], .track-title, .track-artist, .artist-label, .artist-name, .artist-text, .detail-title, .detail-artist, .song-title, .song-artist, .clip-item-text, .playlist-shortcut-name, #lyrics-lines, #lyrics-title, #lyrics-artist, #now-title, #now-artist';
  function value(source) {
    const key = labels[source.trim().toLowerCase()];
    return key ? source.replace(source.trim(), window.lang.t(key, {}, source.trim())) : source;
  }
  function paint(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || node.parentElement.closest(skip)) continue;
      const current = node.nodeValue;
      const previous = originals.get(node);
      const source = previous && current === previous.output ? previous.source : current;
      const output = value(source);
      if (current !== output) node.nodeValue = output;
      originals.set(node, { source, output });
    }
    for (const element of root.querySelectorAll('*')) {
      for (const name of ['title', 'aria-label', 'placeholder']) {
        if (!element.hasAttribute(name) || element.hasAttribute('data-i18n-' + name)) continue;
        const current = element.getAttribute(name);
        const saved = attributes.get(element) || {};
        const previous = saved[name];
        const source = previous && current === previous.output ? previous.source : current;
        const output = value(source);
        saved[name] = { source, output };
        attributes.set(element, saved);
        if (current !== output) element.setAttribute(name, output);
      }
      if (element.shadowRoot) paint(element.shadowRoot);
    }
    if (!watched.has(root)) {
      watched.add(root);
      new MutationObserver(schedule).observe(root, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'],
      });
    }
  }
  function translate() {
    if (window.lang && document.body) paint(document.body);
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      translate();
    });
  }
  fetch('/js/i18n/ui.json').then(response => {
    if (!response.ok) throw new Error('Language labels unavailable');
    return response.json();
  }).then(data => {
    labels = data;
    translate();
  }).catch(() => {});
  window.addEventListener('site:languagechange', schedule);
})();
