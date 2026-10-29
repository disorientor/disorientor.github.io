"""Ports every Haecceity .gdshader to WebGL2 (GLSL ES 3.00) for sleeve+press.

The app's shaders are the source of truth. Bodies stay as written: Godot's built-ins (UV, COLOR, ALBEDO,
VERTEX, TIME...) become ordinary GLSL globals that the generated main() fills in and reads back, so
fragment() and vertex() run unchanged. Each entry carries its controls (from shader_manifest.json, else the
uniform's hint_range and default) so the page can build dials without knowing any shader by name.
"""
import json, pathlib, re

APP = pathlib.Path('/Users/disorientor/Desktop/haecceity/Haecceity/standalone/demo')

# Uniforms the page drives itself rather than showing as dials.
DRIVEN = {'u_resolution', 'res', 'resolution', 'u_time', 'time', 'TIME', 'u_screen_rect', 'u_fade',
          'u_layer_opacity', 'frame', 'first', 'motion_time', 'has_prev'}
# Per-shader starting values where the app's default is "off" because a controller raises it live.
OVERRIDES = {
    'composition_reaction_view': {'amount': 1.0}, 'composition_automata_view': {'amount': 1.0},
    'composition_glow_view': {'amount': 1.0}, 'composition_temporal': {'amount': 1.0},
    'composition_fx': {'amount': 0.8, 'spike': 0.4}, 'composition_window': {'flash': 0.0},
    'composition_points': {'amount': 1.0, 'explode': 0.15, 'size': 0.6, 'depth': 0.6, 'yaw': 0.35, 'pitch': 0.2},
    'composition_volume': {'density': 0.7, 'form': 0.8}, 'composition_cymatics': {'amount': 1.0, 'energy': 0.6},
    'composition_databend': {'amount': 0.8, 'sort_amt': 0.6, 'block_amt': 0.6},
}
GROUPS = [('glitch', 'shaders/glitch/*.gdshader'), ('backgrounds', 'shaders/backgrounds/*.gdshader'),
          ('mesh_surfaces', 'shaders/mesh_surfaces/*.gdshader'), ('composition', 'shaders/composition_*.gdshader'),
          ('stage', '*.gdshader')]

UNIFORM = re.compile(r'\buniform\s+(?:highp\s+|mediump\s+|lowp\s+)?(\w+)\s+(\w+)\s*(\[\s*\d+\s*\])?\s*(?::\s*([^=;]*))?(?:=\s*([^;]*))?;')
VARYING = re.compile(r'\bvarying\s+((?:flat\s+|smooth\s+)?(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+\w+(?:\s*\[\s*\d+\s*\])?)\s*;')
RESERVED = ['active', 'patch', 'sample', 'input', 'output', 'filter', 'common', 'partition', 'superp', 'resource',
            'attribute', 'buffer', 'shared', 'coherent', 'restrict', 'readonly', 'writeonly', 'subroutine', 'namespace',
            'using', 'template', 'typedef', 'union', 'goto', 'inline', 'noinline', 'volatile', 'public', 'static',
            'extern', 'external', 'interface', 'long', 'short', 'double', 'half', 'fixed', 'unsigned', 'cast', 'class',
            'sizeof', 'asm', 'enum', 'this', 'packed', 'hvec2', 'hvec3', 'hvec4', 'fvec2', 'fvec3', 'fvec4']
SIZES = {'float': 1, 'int': 1, 'bool': 1, 'uint': 1, 'vec2': 2, 'vec3': 3, 'vec4': 4, 'ivec2': 2, 'ivec3': 3,
         'ivec4': 4, 'mat3': 9, 'mat2': 4, 'mat4': 16}

def inline(path, seen=None):
    seen = seen or set()
    text = path.read_text()
    def sub(m):
        ref = m.group(1)
        target = APP / ref[6:] if ref.startswith('res://') else (path.parent / ref)
        if not target.exists(): target = APP / ref
        if target in seen: return ''
        seen.add(target)
        return inline(target, seen)
    return re.sub(r'#include\s+"([^"]+)"', sub, text)

def strip_comments(s):
    return re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), re.sub(r'//[^\n]*', '', s), flags=re.S)

def numbers(expr, n, typ):
    """A default like 1.0, vec3(0.85), ivec2(160, 100) or mat3(1.0) as a flat list; None if not literal."""
    expr = expr.strip()
    if expr in ('true', 'false'): return [1.0 if expr == 'true' else 0.0]
    ctor = re.match(r'^[iub]?(?:vec|mat)\d\s*\((.*)\)$', expr, re.S)
    if ctor: expr = ctor.group(1)
    elif re.search(r'[A-Za-z_]', expr): return None
    if re.search(r'[A-Za-z_]', expr): return None
    vals = re.findall(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?', expr)
    if not vals: return None
    vals = [float(v) for v in vals]
    if typ.startswith('mat') and len(vals) == 1:
        k = int(typ[3]); return [vals[0] if i % (k + 1) == 0 else 0.0 for i in range(k * k)]
    if len(vals) == 1: vals = vals * n
    return vals[:n] if len(vals) >= n else None

def convert(path, group, manifest):
    sid = path.stem
    raw = inline(path)
    kind = re.search(r'shader_type\s+(\w+)', raw).group(1)
    render = ' '.join(re.findall(r'render_mode\s+([^;]*);', raw))
    blend = 'add' if 'blend_add' in render else ('mix' if 'blend_mix' in render else 'none')
    comments = {}
    for m in UNIFORM.finditer(raw):
        line_end = raw.find('\n', m.end())
        c = re.match(r'\s*//\s*(.*)', raw[m.end():line_end if line_end > 0 else None])
        if c: comments[m.group(2)] = c.group(1).strip()
    src = strip_comments(raw)
    src = re.sub(r'shader_type\s+\w+\s*;', '', src)
    src = re.sub(r'render_mode\s+[^;]*;', '', src)

    man = {u['name']: u for u in manifest.get(sid, {}).get('uniforms', [])}
    uniforms, samplers = [], {}
    def uni(m):
        typ, name, arr, hints, default = m.groups()
        hints = hints or ''
        if typ.startswith('sampler'):
            samplers[name] = 'prev' if name in ('tPrevFrame', 'prev', 'prev_frame') else 'src'
            return f'uniform {typ} {name};'
        n = SIZES.get(typ, 1)
        count = int(arr.strip('[] ')) if arr else 1
        u = {'n': name, 't': typ}
        if arr: u['arr'] = count
        d = numbers(default, n, typ) if default else None
        u['def'] = d if d is not None else [0.0] * (n * count)
        if name in OVERRIDES.get(sid, {}): u['def'] = [float(OVERRIDES[sid][name])] * n
        if name in DRIVEN: u['role'] = 'driven'
        elif arr or typ.startswith('mat'): u['role'] = 'internal'
        if name in man:
            mu = man[name]; u.update(min=mu['min'], max=mu['max'], step=mu['step'], label=mu['label'])
            if name not in OVERRIDES.get(sid, {}): u['def'] = [float(mu['default'])] * n
        else:
            hr = re.search(r'hint_range\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*(?:,\s*([-\d.]+))?', hints)
            if hr:
                u.update(min=float(hr.group(1)), max=float(hr.group(2)), step=float(hr.group(3) or 0.01))
            elif typ in ('float', 'int'):
                v = u['def'][0]; hi = max(1.0, abs(v) * 2.0)
                u.update(min=min(0.0, -hi if v < 0 else 0.0), max=hi, step=1.0 if typ == 'int' else 0.01)
            if 'source_color' in hints or typ in ('vec3', 'vec4') and re.search(r'col|ink|tint|bg', name): u['color'] = True
            u['label'] = name.replace('u_', '', 1).replace('_', ' ').capitalize()
        if name in comments: u['hint'] = comments[name]
        uniforms.append(u)
        return f'uniform {typ} {name}{arr or ""};'
    src = UNIFORM.sub(uni, src)

    varyings = VARYING.findall(src)
    src = VARYING.sub('', src)
    src = re.sub(r'\bvoid\s+fragment\s*\(\s*\)', 'void godot_fragment()', src)
    has_vertex = bool(re.search(r'\bvoid\s+vertex\s*\(\s*\)', src))
    src = re.sub(r'\bvoid\s+vertex\s*\(\s*\)', 'void godot_vertex()', src)
    # Godot accepts a few spellings GLSL ES rejects: float suffixes and identifiers GLSL reserves.
    src = re.sub(r'(\d\.\d*)f\b', r'\1', src)
    src = re.sub(r'\b(' + '|'.join(RESERVED) + r')\b', r'\1_', src)
    # Godot's built-in constants, unless the shader defines its own.
    consts = ''.join(f'#define {k} {v}\n' for k, v in (('PI', '3.14159265358979'), ('TAU', '6.28318530717959'), ('E', '2.71828182845905'))
                     if re.search(r'\b' + k + r'\b', src) and not re.search(r'(const\s+\w+|#define)\s+' + k + r'\b', src))
    src = consts + src
    name = manifest.get(sid, {}).get('name') or sid.replace('_', ' ').upper()
    return {'id': sid, 'name': name, 'group': group, 'kind': kind, 'blend': blend, 'unshaded': 'unshaded' in render, 'vertex': has_vertex,
            'varyings': varyings, 'uniforms': uniforms, 'samplers': samplers, 'body': src.strip()}

def build():
    man = json.loads((APP / 'shaders/shader_manifest.json').read_text())
    manifest = {e['id']: e for section in man.values() for e in section}
    seen, out = set(), []
    for group, pattern in GROUPS:
        for path in sorted(APP.glob(pattern)):
            if path in seen: continue
            seen.add(path)
            out.append(convert(path, group, manifest))
    return out

if __name__ == '__main__':
    import sys
    shaders = build()
    if '--json' in sys.argv: sys.exit(print(json.dumps(shaders)))
    for s in shaders: print(f"{s['group']:14} {s['kind']:12} {s['id']}")
    print(len(shaders), 'shaders')
