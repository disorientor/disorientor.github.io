shader_type canvas_item;
uniform float u_fade = 1.0;
uniform sampler2D tDiffuse : hint_default_black;
uniform sampler2D tPrevFrame : hint_default_black;
uniform vec2 u_resolution = vec2(1060.0, 550.0);
uniform float u_time = 0.0;
/*
 * TRIP MATH SUITE - SHADER T16: SACRED MERKABA & METATRON PLASMA FLUX MATRIX
 * -----------------------------------------------------------------------------
 * Synthesizes sacred geometry, counter-rotating star tetrahedra, and plasma vortex field:
 *   - The Merkaba Light Vehicle: Two interlocking, counter-rotating tetrahedra
 *     (one pointed upward toward the divine cosmos, one pointed downward into the material void).
 *   - Rotates at the light-field ratio (v_up / v_down = 34 / 21, consecutive Fibonacci numbers).
 *   - Metatron's Cube: 13-sphere flower of life projection enclosing all 5 Platonic solids.
 *   - Toroidal plasma energy vortex with logarithmic golden spiral phyllotaxis streamlines.
 */






uniform float u_intensity = 1.0;        // Merkaba spin rate (default: 1.0)
uniform float u_tetra_scale = 1.65;      // Star tetrahedron radius (0.8 to 2.5)
uniform float u_metatron_rays = 1.0;    // Metatron cube projection ray brightness
uniform float u_torus_vortex = 1.0;     // Toroidal plasma field swirl velocity
uniform float u_sacred_gold = 1.0;      // Alchemical golden light emission

float segment3(vec3 p, vec3 a, vec3 b) {
    vec3 v = b-a;
    return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.0,1.0));
}
float tetraEdges(vec3 p, float radius) {
    vec3 a=vec3(1,1,1)*radius;
    vec3 b=vec3(1,-1,-1)*radius;
    vec3 c=vec3(-1,1,-1)*radius;
    vec3 d=vec3(-1,-1,1)*radius;
    return min(min(min(segment3(p,a,b),segment3(p,a,c)),min(segment3(p,a,d),segment3(p,b,c))),min(segment3(p,b,d),segment3(p,c,d)))-.018;
}
float mapMerkaba(vec3 p, out vec3 tint) {
    float a=u_time*.19*u_intensity;
    float b=-u_time*.19*(21.0/34.0)*u_intensity;
    vec3 up=p, down=p;
    up.xz=mat2(vec2(cos(a),-sin(a)),vec2(sin(a),cos(a)))*up.xz;
    down.xz=mat2(vec2(cos(b),-sin(b)),vec2(sin(b),cos(b)))*down.xz;
    down.y=-down.y;
    float r=max(.5,u_tetra_scale)*.52;
    float d1=tetraEdges(up,r), d2=tetraEdges(down,r);
    tint=d1<d2 ? vec3(.12,.72,1.0) : vec3(1.0,.3,.18);
    return min(d1,d2);
}
float line2(vec2 p, vec2 a, vec2 b) {
    vec2 v=b-a;
    return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.0001),0.0,1.0));
}
void mainImage(vec2 uv, out vec4 out_col) {
    vec2 p=(uv-.5)*2.0;
    p.x*=u_resolution.x/max(1.0,u_resolution.y);
    vec3 ro=vec3(0.0,.15,4.6), rd=normalize(vec3(p,-2.4));
    vec3 col=vec3(.002,.004,.012);
    float t=.1;
    vec3 glow=vec3(0.0);
    for(int i=0;i<72;i++) {
        vec3 tint;
        float d=mapMerkaba(ro+rd*t,tint);
        glow+=tint*exp(-abs(d)*38.0)*.045;
        if(d<.002) { col+=tint*1.9; break; }
        t+=max(.008,d*.75);
        if(t>8.0) break;
    }
    col+=glow;
    // Thirteen flower-of-life nodes and finite connecting chords, behind the open star.
    float network=0.0;
    float circles=0.0;
    for(int i=0;i<6;i++) {
        float a=float(i)*1.04719755+u_time*.018;
        vec2 n=vec2(cos(a),sin(a));
        vec2 inner=n*.48, outer=n*.96;
        circles+=exp(-abs(length(p-inner)-.48)*280.0);
        network+=exp(-line2(p,vec2(0.0),outer)*360.0);
        network+=exp(-line2(p,inner,vec2(cos(a+2.094395),sin(a+2.094395))*.96)*360.0);
        col+=vec3(.3,.6,.85)*exp(-length(p-outer)*200.0)*.55;
    }
    float r=length(p), angle=atan(p.y,p.x);
    float torus=exp(-pow((r-.8)*5.0,2.0));
    float ribbon=pow(.5+.5*sin(angle*5.0-r*18.0+u_time*.5*u_torus_vortex),16.0);
    col+=vec3(.09,.23,.5)*torus*ribbon*.38*u_intensity;
    col+=vec3(.18,.48,.7)*(network*.14+circles*.12)*u_metatron_rays;
    col+=vec3(1.0,.59,.18)*exp(-r*6.0)*.15*u_sacred_gold;
    col=vec3(1.0)-exp(-col*1.2);
    col*=1.0-smoothstep(1.0,2.1,r)*.65;
    out_col=vec4(col,1.0);
}
void fragment() {
    vec4 col;
    mainImage(vec2(UV.x,1.0-UV.y),col);
    COLOR=vec4(col.rgb,u_fade);
}
