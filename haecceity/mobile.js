(() => {
    const mobile = matchMedia('(pointer: coarse)').matches;
    const gate = document.getElementById('mobile-gate');
    const enter = document.getElementById('enter-performance');
    const message = document.getElementById('mobile-message');
    const fullscreen = document.getElementById('fullscreen');
    let entered = false;
    function update() {
        const portrait = matchMedia('(orientation: portrait)').matches;
        gate.hidden = !mobile || (entered && !portrait);
        message.textContent = portrait ? 'Rotate your phone to landscape to play.' : 'Tap to start audio and enter fullscreen.';
        enter.textContent = entered ? 'Enter fullscreen' : 'Enter Haecceity';
        fullscreen.hidden = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    }
    async function lockLandscape() {
        try { await screen.orientation?.lock?.('landscape'); } catch (_) { /* Rotation prompt remains available. */ }
    }
    async function start() {
        entered = true;
        window._void_cantor?.resumeIfNeeded();
        const root = document.documentElement;
        try {
            if (!document.fullscreenElement && root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
            else if (!document.webkitFullscreenElement && root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
            else if (!root.requestFullscreen && !root.webkitRequestFullscreen) {
                document.getElementById('home-screen-tip').hidden = false;
            }
        } catch (_) { /* User can retry using the fullscreen button. */ }
        if (mobile) await lockLandscape();
        update();
    }
    enter.addEventListener('click', start);
    fullscreen.addEventListener('click', start);
    addEventListener('resize', update);
    document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement && mobile) lockLandscape(); update(); });
    document.addEventListener('webkitfullscreenchange', update);
    addEventListener('haecceity-audio-error', event => {
        const notice = document.getElementById('audio-error');
        notice.textContent = event.detail; notice.hidden = false;
    });
    update();
})();
