// content script: add copy buttons to code blocks
const SELECTORS = [
  'pre > code',
  '.s-code-block',
  '.highlight pre',
  'pre[class*="lang-"]',
  'div[class*="snippet"]'
];

function findCodeBlocks(root = document) {
  return Array.from(root.querySelectorAll(SELECTORS.join(',')))
    .map(node => node.tagName.toLowerCase() === 'code' ? node.parentElement : node)
    .filter(Boolean);
}

function makeButton() {
  const btn = document.createElement('button');
  btn.className = 'copy-code-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Copy code');
  btn.textContent = 'Copy';
  return btn;
}

function showToast(text) {
  let t = document.getElementById('copy-code-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'copy-code-toast';
    t.className = 'copy-toast';
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add('visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('visible'), 2000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied!');
  } catch (err) {
    showToast('Copy failed');
    console.error('Copy failed', err);
  }
}

function addButtons(root = document) {
  findCodeBlocks(root).forEach(pre => {
    if (pre.querySelector('.copy-code-btn')) return;
    const computed = getComputedStyle(pre);
    if (computed.position === 'static') pre.style.position = 'relative';

    const btn = makeButton();
    btn.addEventListener('click', () => {
      const codeEl = pre.querySelector('code');
      const text = codeEl ? codeEl.innerText : pre.innerText;
      copyText(text);
    });

    pre.appendChild(btn);
  });
}

// initial run
addButtons();

// record last right-click target (helps copy code block at caret/context)
document.addEventListener('contextmenu', (e) => {
  window._lastRightClicked = e.target;
}, true);

// helper: strip prompts (default behavior: strip shell ($) and python (>>>) prompts)
const DEFAULT_STRIP_OPTIONS = { stripShell: true, stripPython: true };
function stripPrompts(text, opts = DEFAULT_STRIP_OPTIONS) {
  const lines = text.split('\n');
  return lines.map(l => {
    let s = l;
    if (opts.stripShell) s = s.replace(/^\s*([$>])\s?/, '');
    if (opts.stripPython) s = s.replace(/^\s*(>>> |\.\.\. )/, '');
    return s;
  }).join('\n');
}

// copy selection or given text, with optional cleaning
async function performCopy(rawText, clean = true) {
  const text = clean ? stripPrompts(rawText || '') : (rawText || '');
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied!');
    return true;
  } catch (err) {
    console.error('Copy failed', err);
    showToast('Copy failed');
    return false;
  }
}

// copy the user's selection (if any), otherwise copy a code block near caret
async function copySelectionOrBlock() {
  const sel = window.getSelection();
  const raw = sel && sel.toString().trim();
  if (raw) return performCopy(raw, true);

  // no selection: try to find code block near caret or last right-click
  const el = document.activeElement && document.activeElement.closest && document.activeElement.closest('pre, .s-code-block')
    || (window._lastRightClicked && window._lastRightClicked.closest && window._lastRightClicked.closest('pre, .s-code-block'));
  if (el) {
    const codeEl = el.querySelector('code') || el;
    return performCopy(codeEl.innerText, true);
  }
  showToast('No selection or code block found');
  return false;
}

// listen for messages from background (context menu / commands)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;
    if (msg.action === 'copy-selection') {
      // if selectionText passed from background (context menu), use it
      const selText = msg.selectionText || (window.getSelection && window.getSelection().toString());
      if (selText) performCopy(selText, true);
      else copySelectionOrBlock();
    }
    if (msg.action === 'copy-code-at-caret') {
      // copy full code block at caret or last right-click
      const el = document.activeElement && document.activeElement.closest && document.activeElement.closest('pre, .s-code-block')
        || (window._lastRightClicked && window._lastRightClicked.closest && window._lastRightClicked.closest('pre, .s-code-block'));
      if (el) {
        const codeEl = el.querySelector('code') || el;
        performCopy(codeEl.innerText, true);
      } else showToast('No code block found');
    }
  });
}

// observe DOM changes for dynamically injected content
const observer = new MutationObserver((mutations) => {
  addButtons();
});
observer.observe(document.body, { childList: true, subtree: true });

// handle SPA navigation
window.addEventListener('popstate', () => setTimeout(addButtons, 50));
