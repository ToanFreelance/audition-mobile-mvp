"""V1.9.4 isolated Natural/Doll eye-region geometry rebuild (V1.9.3 GLB input).

Not a viewer contour modifier. Resculpts the *exported* lid patch, socket
transition and ocular cap, and re-targets per-pose liner/eyelash meshes.
Keeps accepted iris textures and other seven look meshes byte-identical.
Usage: python reconstruct_eye_region.py <v193.glb> <candidate.glb>
"""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np
from scipy.interpolate import PchipInterpolator

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "eye-pack-v19"))
from glb_tools import GLB

EXPECTED_SHA = "a80088aed5356e2b1b7344f347d77e9c240fdd1ae0755c3771b9de12d31869e4"
# Landmarks digitized against the OWNER-ACCEPTED concept in V1.9.1.
# Concept-derived shapes are the aesthetic authority, NOT the V1.9.3 eye contour.
PROFILES = {
    "natural": {
        "x": [68, 77, 91, 110, 130, 148, 161, 169],
        "top": [420, 407, 398, 391, 392, 400, 415, 439],
        "bottom": [420, 440, 448, 450, 449, 446, 443, 439],
        "width": 0.126, "center": (118.5, 423), "opening": 0.88,
        "rim": 0.0022,
    },
    "doll": {
        "x": [794, 805, 820, 837, 854, 871, 887, 895],
        "top": [728, 712, 702, 699, 701, 713, 735, 757],
        "bottom": [728, 755, 769, 776, 776, 771, 762, 757],
        "width": 0.125, "center": (844.5, 738), "opening": 0.88,
        "rim": 0.0028,
    },
}
SIDES = {"L": -1, "R": 1}


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t*t*(3-2*t)


def vertex_normals(positions, triangles):
    n = np.zeros_like(positions, dtype=float)
    face = np.cross(positions[triangles[:, 1]]-positions[triangles[:, 0]],
                    positions[triangles[:, 2]]-positions[triangles[:, 0]])
    for k in range(3):
        np.add.at(n, triangles[:, k], face)
    length = np.linalg.norm(n, axis=1, keepdims=True)
    n /= np.maximum(length, 1.e-12)
    return n.astype(np.float32)


def positions(g, prim):
    rest = g.array(prim["attributes"]["POSITION"]).astype(float)
    morphs = prim.get("targets", [])
    if not morphs:
        return [rest]
    if len(morphs) != 2:
        raise ValueError("Expected Blink and BlinkArc targets")
    closed = rest + g.array(morphs[0]["POSITION"])
    half = .5*(rest+closed) + g.array(morphs[1]["POSITION"])
    return [rest, half, closed]


def put_frames(g, prim, frames, preserve_seam=0):
    old_rest = g.array(prim["attributes"]["POSITION"])
    old_n = g.array(prim["attributes"]["NORMAL"])
    triangles = g.array(prim["indices"]).reshape(-1, 3).astype(np.int64)
    frames = [np.asarray(f, dtype=np.float32) for f in frames]
    if any(f.shape != old_rest.shape or not np.isfinite(f).all() for f in frames):
        raise ValueError("Invalid frame geometry")
    nn = [vertex_normals(f, triangles) for f in frames]
    if preserve_seam:
        nn[0][-preserve_seam:] = old_n[-preserve_seam:]
    prim["attributes"]["POSITION"] = g.add_array(frames[0])
    prim["attributes"]["NORMAL"] = g.add_array(nn[0])
    if len(frames) == 3:
        prim["targets"][0]["POSITION"] = g.add_array(frames[2]-frames[0])
        prim["targets"][1]["POSITION"] = g.add_array(frames[1]-(frames[0]+frames[2])*.5)
        prim["targets"][0]["NORMAL"] = g.add_array(nn[2]-nn[0])
        prim["targets"][1]["NORMAL"] = g.add_array(nn[1]-(nn[0]+nn[2])*.5)
    return float(np.max(np.linalg.norm(frames[0]-old_rest, axis=1)))


def interpolate(values, xs, query):
    order = np.argsort(xs)
    # PCHIP is shape preserving; duplicates are invalid source mesh topology.
    clean_x, where = np.unique(np.asarray(xs)[order], return_index=True)
    clean_y = np.asarray(values)[order][where]
    if len(clean_x) < 4:
        raise ValueError("Insufficient aperture samples")
    return PchipInterpolator(clean_x, clean_y, extrapolate=False)(np.clip(query, clean_x[0], clean_x[-1]))


def desired_aperture(look, t, cy, source_endpoints):
    p = PROFILES[look]
    xx = np.asarray(p["x"], dtype=float)
    # Reversed pixel X corresponds to outer-positive eye-local t.
    knots = ((xx[-1]-xx)/(xx[-1]-xx[0])*2-1)[::-1]
    ratio = p["width"]/(xx[-1]-xx[0])
    top = cy+(p["center"][1]-PchipInterpolator(knots, np.array(p["top"])[::-1])(t))*ratio
    low = cy+(p["center"][1]-PchipInterpolator(knots, np.array(p["bottom"])[::-1])(t))*ratio
    original_mid = (top+low)*.5
    profile_gap = np.maximum(top-low, 0)
    # Balanced soft lid arcs rather than oversized circular white openings.
    analytic = np.max(profile_gap)*np.maximum(0, 1-t*t)**.68
    gap = p["opening"]*(.80*profile_gap + .20*analytic)
    mid = cy+(original_mid-cy)*.82+.0012*(1-t*t)
    new_top, new_low = mid+gap*.52, mid-gap*.48
    # Lock EXACT canthi to the input and taper the correction inside the corner.
    w = 1-smooth(.89, 1., np.abs(t))
    return (source_endpoints[0]*(1-w)+new_top*w,
            source_endpoints[1]*(1-w)+new_low*w)


def reconstruct(g, look, side, by_name):
    prefix = f"EyeSet_{look}_{side}_"
    lid_index = by_name[prefix+"Lids_V191"]
    eye_index = by_name[prefix+"Ocular_V1"]
    lidnode = g.j["nodes"][lid_index]
    lp = g.mesh(lid_index)
    frames = positions(g, lp)
    rest = frames[0]
    n = int(lidnode["extras"]["innerVertices"])
    nu = (n+2)//2
    if n < 100 or nu < 50:
        raise ValueError("Unexpected v191 lid topology")
    uppers = [f[:nu] for f in frames]
    lowers = [np.vstack([f[0], f[nu:n], f[nu-1]]) for f in frames]
    # Use geometric X sampling, not positional index on the source collar.
    x0, x1 = float(np.min(uppers[0][:, 0])), float(np.max(uppers[0][:, 0]))
    cx, hw = (x0+x1)*.5, (x1-x0)*.5
    cy = float(lidnode["extras"].get("eyeCenterY", .5174 if side=="L" else .5172))
    sign = SIDES[side]
    def old_curve(pose, x):
        f = frames[pose]
        return (interpolate(uppers[pose][:, 1], uppers[pose][:, 0], x),
                interpolate(lowers[pose][:, 1], lowers[pose][:, 0], x))
    x_ref = uppers[0][:, 0]
    tu = np.clip((x_ref-cx)*sign/hw, -1, 1)
    ref_old_up, ref_old_low = old_curve(0, x_ref)
    concept_up, concept_low = desired_aperture(look, tu, cy, (ref_old_up, ref_old_low))
    def target_curve(x, pose):
        u = interpolate(concept_up, x_ref, x)
        l = interpolate(concept_low, x_ref, x)
        c = l+.22*(u-l)  # Same global blink closure profile as V1.9.1.
        if pose == 0:
            return u, l
        if pose == 1:
            return .5*(u+c), .5*(l+c)
        return c, c

    # The eyeball is a textured 22-ring cap. Rebuild every concentric vertex
    # in local 3D; do NOT change its accepted iris UV/texture coordinates.
    eye = g.mesh(eye_index)
    er = g.array(eye["attributes"]["POSITION"]).astype(float)
    ring_count = (len(er)-1)//n
    if ring_count < 10 or (len(er)-1) != n*ring_count:
        raise ValueError("Unexpected ocular cap topology")
    new_inner = np.concatenate([np.c_[uppers[0][:, 0], concept_up],
                np.c_[frames[0][nu:n, 0], interpolate(concept_low, x_ref, frames[0][nu:n, 0])]])
    oc = er[0, :2]
    out_eye = er.copy()
    for k in range(1, ring_count+1):
        f = k/ring_count
        out_eye[1+(k-1)*n:1+k*n, :2] = oc+(new_inner-oc)*f
    # Use a smooth original ocular quadratic (camera-facing Z) with no shell.
    qxy = (er[:, :2]-oc)/np.array([.065, .055])
    matrix = np.column_stack((np.ones(len(er)), qxy[:, 0], qxy[:, 1],
                              qxy[:, 0]**2, qxy[:, 0]*qxy[:, 1], qxy[:, 1]**2))
    coeff = np.linalg.lstsq(matrix, er[:, 2], rcond=None)[0]
    def cap_z(x, y):
        xx=(np.asarray(x)-oc[0])/.065; yy=(np.asarray(y)-oc[1])/.055
        return (coeff[0]+coeff[1]*xx+coeff[2]*yy+coeff[3]*xx*xx+coeff[4]*xx*yy+coeff[5]*yy*yy)
    out_eye[:, 2] = cap_z(out_eye[:, 0], out_eye[:, 1])
    eye_moved = put_frames(g, eye, [out_eye])

    # Retopology-compatible LOCAL SOCKET RESCULPT. Move every lid-patch vertex
    # using a smooth transition back to the unchanged static skin collar.
    # No vertex beyond the socket collar is modified; source head seam stays.
    x = rest[:, 0]
    old_top, old_low = old_curve(0, x)
    mid = (old_top+old_low)/2
    belongs_upper = rest[:, 1] >= mid
    belongs_upper[:nu] = True
    belongs_upper[nu:n] = False
    old_edge = np.where(belongs_upper, old_top, old_low)
    distance = np.abs(rest[:, 1]-old_edge)
    t = np.clip((x-cx)*sign/hw, -1, 1)
    edge_weight = (1-smooth(.006, .047, distance)) * (1-smooth(.93, 1.02, np.abs(t)))
    seam = int(lidnode["extras"]["seamVertices"])
    edge_weight[-seam:] = 0
    # Convex facial transition follows the ocular surface near the opening,
    # while the far surface blends into the untouched original patch.
    sculpt = []
    for pose, frame in enumerate(frames):
        top_old, low_old = old_curve(pose, x)
        top_new, low_new = target_curve(x, pose)
        delta = np.where(belongs_upper, top_new-top_old, low_new-low_old)
        f = frame.copy()
        f[:, 1] += delta*edge_weight
        edge_y = np.where(belongs_upper, top_new, low_new)
        near = (1-smooth(.003, .034, distance))*(1-smooth(.93, 1.02, np.abs(t)))
        near[-seam:] = 0
        z_skin = cap_z(f[:, 0], f[:, 1])+.0028
        # Rest and closure share ONE fitted socket, avoiding denting during blink.
        f[:, 2] += (z_skin-f[:, 2])*near
        f[-seam:] = frame[-seam:]
        sculpt.append(f)
    lid_moved = put_frames(g, lp, sculpt, preserve_seam=seam)

    # All 1.9.3 lashes, liner, crease, wing and shadow follow their own real
    # Blink/BlinkArc poses. No 2D overlay; no duplicated unretargeted meshes.
    cosmetics = []
    for name, nid in by_name.items():
        if not name.startswith(prefix) or not name.endswith("_V193"):
            continue
        prim = g.mesh(nid)
        original = positions(g, prim)
        # Interpret upper/lower by proximity to the original source lid edge.
        rr = original[0]
        ox = rr[:, 0]
        up0, lo0 = old_curve(0, ox)
        up_distance = np.abs(rr[:, 1]-up0)
        low_distance = np.abs(rr[:, 1]-lo0)
        is_up = up_distance <= low_distance
        d = np.minimum(up_distance, low_distance)
        if "LashFan" in name:
            weight = np.ones(len(rr))  # Tips follow roots through all poses.
        else:
            weight = 1-smooth(.012, .055, d)
        # Each cosmetic module has its original exact vertex ordering/morph.
        revised = []
        for pose, frame in enumerate(original):
            old_u, old_l = old_curve(pose, ox)
            new_u, new_l = target_curve(ox, pose)
            y_delta = np.where(is_up, new_u-old_u, new_l-old_l)
            v = frame.copy()
            v[:, 1] += y_delta*weight
            revised.append(v)
        magnitude = put_frames(g, prim, revised)
        cosmetics.append({"name": name, "maxDisplacement": magnitude})

    # Strong assertions: the redesigned 3D eyelid drives the selected iris cap,
    # and every pose has finite vertices. Never claim visual acceptance here.
    aperture_gap = float(np.max(concept_up-concept_low))
    return {"look":look,"side":side,"newMaxOpening":aperture_gap,
            "lidVertices":len(rest),"lidMaxDisplacement":lid_moved,
            "ocularVertices":len(er),"ocularMaxDisplacement":eye_moved,
            "morphCosmetics":cosmetics,"seamVerticesLocked":seam}


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, out = map(Path, sys.argv[1:3])
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA:
        raise SystemExit(f"V1.9.3 SHA mismatch: {digest} (expected {EXPECTED_SHA})")
    g = GLB(src)
    names = {n.get("name", ""): i for i, n in enumerate(g.j["nodes"])}
    original_images = [(im.get("bufferView"), im.get("mimeType")) for im in g.j["images"]]
    reports = [reconstruct(g, look, side, names)
               for look in PROFILES for side in SIDES]
    if original_images != [(im.get("bufferView"), im.get("mimeType")) for im in g.j["images"]]:
        raise AssertionError("Iris/image index mutation is forbidden")
    g.j["asset"].setdefault("extras", {})["eyeRegionV194"] = {
        "status": "candidate-unreviewed", "anchors": list(PROFILES),
        "sourceV193SHA256": digest, "ownerAccepted": False,
        "method": "concept-driven full lid patch/socket and 22-ring ocular reconstruction; per-pose cosmetic retargeting",
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    g.write(out)
    report = {"status":"CANDIDATE_NOT_VISUALLY_ACCEPTED",
              "sourceSHA256":digest,"outputSHA256":hashlib.sha256(out.read_bytes()).hexdigest(),
              "outputBytes":out.stat().st_size,"eyes":reports}
    out.with_suffix(".json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()