// Precompiled bridge entry points, invoked directly by JavaScriptBridge.
window._haecceity_bridge = {
    command(organism, name, argsJSON) {
        const args = JSON.parse(argsJSON);
        window._void_cantor?.world.command(organism, name, args);
        if (!['preview', 'stop_preview', 'set_patch', 'drone', 'track_solo', 'performance_palette', 'performance_character'].includes(name)) {
            window._haecceity_world?.command(organism, name, args);
        }
    },
    visualCommand(name, argsJSON) { window._haecceity_visual?.command(name, JSON.parse(argsJSON)); },
    frame(delta, aspect) {
        try {
            const world = window._haecceity_world, visual = window._haecceity_visual;
            if (!world || !visual) return '{}';
            const events = world.advance(delta);
            if (events) for (const event of events) window._void_cantor?.world.sound(event);
            return JSON.stringify(visual.frame(world.drain_visual(), world.snapshot(), world.time(), aspect));
        } catch (error) { console.error('Frame error:', error); return '{}'; }
    }
};
