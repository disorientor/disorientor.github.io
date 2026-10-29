/* This is a browser-only access barrier. Static files remain publicly accessible. */
(() => {
  'use strict';
  const script = document.currentScript;
  const root = new URL('../', script.src);
  const login = new URL('tools-access/', root);
  const config = window.TOOLS_ACCESS_CONFIG;
  const key = 'disorientor-tools:' + config.verifier;
  const unlocked = () => {
    try { return sessionStorage.getItem(key) === 'unlocked'; }
    catch { return false; }
  };
  const allowed = ['strung_along/chord-grid.html', 'reelcut/', 'reelcut/index.html',
    'sleeve-press/', 'sleeve-press/index.html', 'Reel Cut/reel-cut.html',
    'Reel Cut/reel-cut-offline.html'];
  const destination = value => {
    try {
      const url = new URL(value || 'tools-access/', root);
      const relative = decodeURIComponent(url.pathname.slice(root.pathname.length));
      if (url.origin === root.origin && url.pathname.startsWith(root.pathname) && allowed.includes(relative)) return url;
    } catch {}
    return null;
  };
  if (!script.hasAttribute('data-login')) {
    const check = () => {
      if (unlocked()) {
        document.querySelector('#tools-access-lock')?.remove();
        return;
      }
      document.documentElement.style.visibility = 'hidden';
      login.searchParams.set('next', location.href);
      location.replace(login.href);
    };
    check();
    window.addEventListener('pageshow', check);
    return;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const input = document.querySelector('#password');
    const status = document.querySelector('#status');
    const submit = form.querySelector('button');
    const next = destination(new URL(location.href).searchParams.get('next'));
    const showTools = () => {
      if (next) { location.replace(next.href); return; }
      form.hidden = true;
      document.querySelector('#tools').hidden = false;
      status.textContent = 'Access granted.';
    };
    if (unlocked()) showTools();
    document.querySelector('#lock').addEventListener('click', () => {
      try { sessionStorage.removeItem(key); } catch {}
      location.replace(login.href);
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      status.textContent = 'Checking password…';
      try {
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.value), 'PBKDF2', false, ['deriveBits']);
        const salt = Uint8Array.from(config.salt.match(/../g), hex => parseInt(hex, 16));
        const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: config.iterations}, material, 256);
        const verifier = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
        if (verifier !== config.verifier) {
          status.textContent = 'Incorrect password. Try again.';
          input.value = '';
          input.focus();
          return;
        }
        try { sessionStorage.setItem(key, 'unlocked'); }
        catch { throw new Error('storage'); }
        input.value = '';
        showTools();
      } catch (error) {
        status.textContent = error.message === 'storage'
          ? 'Allow session storage in your browser to unlock the tools.'
          : 'Unable to check the password. Open this site over HTTPS or localhost.';
      } finally { submit.disabled = false; }
    });
  });
})();
