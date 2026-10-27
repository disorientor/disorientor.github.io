// Precompiled bridge entry points, invoked directly by JavaScriptBridge (instruments/web_performance.gd).
// Routing mirrors native HWorld::command (native/world.hpp): these commands stop at the synth and never reach the
// musical model, and live notes reach the synth only as the model's echo, exactly as on macOS.
const SYNTH_ONLY = new Set(['preview', 'stop_preview', 'set_patch', 'track_fx', 'drone', 'drone_fine', 'restart_syllables', 'track_solo', 'performance_palette', 'performance_character']);
window._haecceity_bridge = {
    command(organism, name, argsJSON) {
        const args = JSON.parse(argsJSON);
        // input_note goes to the model, whose outlet returns it as an event; sending it to the synth too doubles every note.
        if (name !== 'input_note') window._void_cantor?.world.command(organism, name, args);
        if (SYNTH_ONLY.has(name)) return true;
        try {
            window._haecceity_world?.command(organism, name, args);
            return true;
        } catch (error) {
            // Native returns false for a command the model rejects (for example to a removed track).
            console.warn('Haecceity model rejected', name, error.message);
            return false;
        }
    },
    visualCommand(name, argsJSON) { window._haecceity_visual?.command(name, JSON.parse(argsJSON)); },
    fxParam(organism, id, name, value) { window._void_cantor?.world.fx_param(organism, id, name, value); },
    // [track, slot id, unit state, bus peak] rows, refreshed by the audio thread at 20 Hz.
    fxState() { return JSON.stringify(window._void_cantor?.world.fx_state || []); },
    syllables() { return JSON.stringify(window._void_cantor?.world.syllables || []); },
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
