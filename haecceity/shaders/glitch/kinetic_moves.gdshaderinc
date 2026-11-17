// KINETIC MOVES - Shared Audio Modulation Uniform Block
// -----------------------------------------------------
// Standard 6-channel dynamic modulation vector streamed from Void Cantor
// DSP engine and spectral analyzers in main.gd.
uniform float u_rPulse : hint_range(0.0, 1.0) = 0.0;   // Kick / transient impact
uniform float u_rScatter : hint_range(0.0, 1.0) = 0.0; // Snare / mid noise crackle
uniform float u_rGlow : hint_range(0.0, 1.0) = 0.0;    // High frequencies / cymbals
uniform float u_rSwell : hint_range(0.0, 1.0) = 0.0;   // Sub-bass / low drone pressure
uniform float u_rSway : hint_range(0.0, 1.0) = 0.0;    // Master RMS envelope / loudness
uniform float u_rRipple : hint_range(0.0, 1.0) = 0.0;  // Melodic pitch contour
