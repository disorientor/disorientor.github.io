shader_type canvas_item;
#include "visual_panel_sampling.gdshaderinc"
uniform sampler2D tDiffuse : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D tPrevFrame : hint_screen_texture, filter_linear_mipmap;
uniform vec2 u_resolution = vec2(1920.0, 1080.0);
uniform float u_time = 0.0;
/*
 * GLITCH SUITE - SHADER 06: BITCRUSH, COLOR QUANTIZATION & ALU BITWISE LOGIC
 * -------------------------------------------------------------------------
 * Emulates digital hardware degradation, arithmetic logic unit (ALU) register
 * overflow, and extreme low-bit depth quantization (1-bit to 5-bit color space).
 * Implements mathematical bitwise XOR, AND, and Bit-Shift operations across color
 * channels and texture addresses, producing harsh neon solarization, False-Color
 * contouring, and brutal retro-digital crunch.
 */






uniform float u_intensity = 1.0;       // Glitch severity & bit corruption probability (default: 1.0)
uniform float u_bit_depth = 3.0;       // Color depth per channel (1.0 to 8.0, default: 3.0)
uniform float u_pixel_resolution = 128.0;// Coordinate downsample factor (e.g. 128.0, 256.0)
uniform float u_alu_mode = 0.0;        // 0.0: Bitwise XOR, 1.0: Bitwise AND, 2.0: Register Overflow Solarize
uniform float u_palette_mode = 0.0;    // 0.0: Standard RGB, 1.0: Cyberpunk CGA, 2.0: Acid Neon, 3.0: 1-Bit Phosphor



// Mathematical extraction of the n-th bit of an 8-bit integer in [0, 255]
float extractBit(float val, float bitIndex) {
    float p = pow(2.0, bitIndex);
    return mod(floor(val / p), 2.0);
}

// Emulated 8-bit bitwise XOR between two float values in [0, 255]
float emulatedXOR(float a, float b) {
    float res = 0.0;
    for (int i = 0; i < 8; i++) {
        float bi = float(i);
        float bitA = extractBit(a, bi);
        float bitB = extractBit(b, bi);
        float xorBit = abs(bitA - bitB);
        res += xorBit * pow(2.0, bi);
    }
    return res;
}

// Emulated 8-bit bitwise AND
float emulatedAND(float a, float b) {
    float res = 0.0;
    for (int i = 0; i < 8; i++) {
        float bi = float(i);
        float bitA = extractBit(a, bi);
        float bitB = extractBit(b, bi);
        float andBit = bitA * bitB;
        res += andBit * pow(2.0, bi);
    }
    return res;
}

void mainImage(vec2 vUv, out vec4 out_col) {
    vec2 uv = vUv;

    // 1. Spatial Coordinate Bitcrush (Resolution Downsampling)
    float pixelRes = max(32.0, u_pixel_resolution);
    vec2 crushedUv = floor(uv * pixelRes) / pixelRes;

    // Optional bitwise address mangling: XOR coordinate bits with time register
    if (u_intensity > 0.6) {
        float addrX = floor(crushedUv.x * 255.0);
        float timeBit = mod(floor(u_time * 8.0), 32.0);
        float xorAddrX = emulatedXOR(addrX, timeBit);
        crushedUv.x = mix(crushedUv.x, xorAddrX / 255.0, (u_intensity - 0.6) * 0.4);
    }

    // Sample downsampled frame
    vec4 baseColor = sample_visual_panel(tDiffuse, clamp(crushedUv, 0.0, 1.0));
    vec3 col = baseColor.rgb;

    // 2. Color Depth Bitcrush / Quantization
    float bitSteps = pow(2.0, clamp(u_bit_depth, 1.0, 8.0)) - 1.0;
    vec3 intCol = floor(col * 255.0); // Convert to 0..255 byte domain

    // 3. ALU Bitwise Logic Glitch
    float timeMask = mod(floor(u_time * 12.0) + floor(crushedUv.y * 32.0), 256.0);

    vec3 aluCol = intCol;
    if (u_alu_mode < 0.5) {
        // Mode 0: Bitwise XOR corruption
        aluCol.r = emulatedXOR(intCol.r, timeMask * 0.7);
        aluCol.g = emulatedXOR(intCol.g, timeMask * 0.5);
        aluCol.b = emulatedXOR(intCol.b, timeMask * 0.9);
    } else if (u_alu_mode < 1.5) {
        // Mode 1: Bitwise AND masking (creates harsh planar clipping)
        aluCol.r = emulatedAND(intCol.r, 255.0 - timeMask * 0.6);
        aluCol.g = emulatedAND(intCol.g, 224.0);
        aluCol.b = emulatedAND(intCol.b, timeMask);
    } else {
        // Mode 2: ALU 8-bit Integer Overflow & Solarization
        // When value exceeds 255, it wraps around modulo 256
        aluCol = mod(intCol * (1.0 + u_intensity * 2.5) + timeMask * 0.5, 256.0);
    }

    // Blend ALU glitch based on intensity
    vec3 crushedRgb = mix(intCol, aluCol, clamp(u_intensity, 0.0, 1.0)) / 255.0;

    // Re-quantize to targeted bit depth
    crushedRgb = floor(crushedRgb * bitSteps + 0.5) / bitSteps;

    // 4. Stylized Color Palette Remapping
    vec3 finalCol = crushedRgb;
    float luma = dot(crushedRgb, vec3(0.299, 0.587, 0.114));

    if (u_palette_mode > 0.5 && u_palette_mode < 1.5) {
        // Mode 1: Cyberpunk CGA Palette (Black, Cyan, Magenta, White)
        if (luma < 0.25) finalCol = vec3(0.0, 0.0, 0.0);
        else if (luma < 0.55) finalCol = vec3(0.0, 0.95, 0.95); // Cyan
        else if (luma < 0.85) finalCol = vec3(0.95, 0.0, 0.85); // Magenta
        else finalCol = vec3(1.0, 1.0, 1.0);
    } else if (u_palette_mode > 1.5 && u_palette_mode < 2.5) {
        // Mode 2: Acid Neon Solarized Palette
        finalCol = vec3(
            sin(luma * 6.28 + u_time) * 0.5 + 0.5,
            cos(luma * 12.56) * 0.5 + 0.5,
            sin(luma * 18.84 + 1.57) * 0.5 + 0.5
        );
    } else if (u_palette_mode > 2.5) {
        // Mode 3: 1-Bit Amber/Green Monochrome CRT
        float threshold = 0.45 + 0.1 * sin(u_time * 4.0);
        float bit1 = step(threshold, luma);
        finalCol = bit1 * vec3(0.1, 1.0, 0.2); // P1 Green Phosphor
    }

    out_col = vec4(finalCol, baseColor.a);
}

void fragment() {
    vec4 col = vec4(0.0);
    mainImage(UV, col);
    COLOR = col;
}
