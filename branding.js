// Rename the mirror's visible site brand without changing URLs, asset paths,
// original legal attribution, or the site's underlying functionality.
(() => {
  const original = /truffled/gi;
  const replacement = 'Thetuber79';
  const attributeNames = ['title', 'placeholder', 'aria-label', 'alt'];
  const skippedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

  function isLegal(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!element?.closest('#info-modal');
  }

  function replaceText(node) {
    if (isLegal(node) || skippedTags.has(node.parentElement?.tagName)) return;
    if (node.parentElement?.matches('h1[data-i18n="home.welcome"]')) {
      const welcome = 'Hi and welcome to DAVIDS WEB';
      if (node.nodeValue !== welcome) node.nodeValue = welcome;
      return;
    }
    const value = node.nodeValue;
    if (value && /truffled/i.test(value)) node.nodeValue = value.replace(original, replacement);
  }

  function replaceAttributes(element) {
    if (isLegal(element)) return;
    for (const name of attributeNames) {
      const value = element.getAttribute(name);
      if (value && /truffled/i.test(value)) element.setAttribute(name, value.replace(original, replacement));
    }
    if (element.tagName === 'META') {
      const key = element.getAttribute('name') || element.getAttribute('property') || '';
      if (/^(title|description|og:title|og:description|og:site_name|twitter:title|twitter:description)$/i.test(key)) {
        const value = element.getAttribute('content');
        if (value && /truffled/i.test(value)) element.setAttribute('content', value.replace(original, replacement));
      }
    }
  }

  function scan(node) {
    if (node.nodeType === Node.TEXT_NODE) return replaceText(node);
    if (node.nodeType !== Node.ELEMENT_NODE || isLegal(node)) return;
    replaceAttributes(node);
    const elements = node.querySelectorAll('[title],[placeholder],[aria-label],[alt],meta[content]');
    for (const element of elements) replaceAttributes(element);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) replaceText(walker.currentNode);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') scan(record.target);
      else if (record.type === 'attributes') replaceAttributes(record.target);
      else for (const node of record.addedNodes) scan(node);
    }
  });
  observer.observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: [...attributeNames, 'content']
  });
  if (document.documentElement) scan(document.documentElement);
  document.addEventListener('DOMContentLoaded', () => scan(document.documentElement));
  window.addEventListener('site:pagechange', () => scan(document.documentElement));
})();
