"""Fit a reviewed single-camera performance to the actual Drophunter/Neurohacker VRM.

Inputs are source-pixel observations, an immutable camera calibration, the canonical
GLB/VRM and the output of the existing stance/contact evaluator. No frame-wise registration.
An output is a candidate until the assembled mesh, contacts and held-out pins are checked.
"""

import argparse
import json
import struct
from pathlib import Path

import numpy as np
from scipy import sparse
from scipy.ndimage import gaussian_filter1d, median_filter
from scipy.sparse.linalg import spsolve
from scipy.spatial.transform import Rotation


def read_rest(path):
    with path.open("rb") as f:
        magic, version, _ = struct.unpack("<4sII", f.read(12))
        size, chunk = struct.unpack("<I4s", f.read(8))
        if (magic, version, chunk) != (b"glTF", 2, b"JSON"):
            raise ValueError("Expected a glTF2 binary rig")
        nodes = json.loads(f.read(size))["nodes"]
    rest = {}
    for n in nodes:
        name = n.get("name", "")
        if name in (
            "hips",
            "spine",
            "chest",
            "upper_chest",
            "head",
            "neck",
        ) or name.startswith(
            (
                "shoulder.",
                "upper_arm.",
                "lower_arm.",
                "hand.",
                "upper_leg.",
                "lower_leg.",
                "foot.",
                "eye.",
            )
        ):
            if not np.allclose(
                n.get("rotation", [0, 0, 0, 1]), [0, 0, 0, 1]
            ) or not np.allclose(n.get("scale", [1, 1, 1]), 1):
                raise ValueError("Unrecognized joint rest axes: " + name)
            rest[name] = np.asarray(n.get("translation", [0, 0, 0]))
    return rest


def rotate(angle, axis):
    vec = np.zeros((len(angle), 3))
    vec[:, axis] = angle
    return Rotation.from_rotvec(vec).as_matrix()


def mul(m, v):
    return (
        np.einsum("nij,j->ni", m, v)
        if np.ndim(v) == 1
        else np.einsum("nij,nj->ni", m, v)
    )


def project(p, camera):
    s, tilt = camera["s"], camera["tilt"]
    return np.stack(
        [
            camera["ox"] + s * p[:, 0],
            camera["oy"] + s * (np.sin(tilt) * p[:, 2] - np.cos(tilt) * p[:, 1]),
        ],
        axis=1,
    )


def target_series(rows, name):
    a = np.array([r["points"].get(name, [0, 0, 0])[:3] for r in rows], dtype=float)
    # Only observations contribute to the objective. Filtering never changes the mask.
    w = a[:, 2]
    x = gaussian_filter1d(a[:, :2] * w[:, None], 1.35, axis=0)
    weight = gaussian_filter1d(w, 1.35)
    return x / np.maximum(weight[:, None], 0.0001), w


def fill_prior(value, valid):
    t = np.arange(len(valid))
    return np.interp(t, t[valid], value[valid]) if np.any(valid) else t * 0.0


def pose(q, rest, crown_offset, pelvic_share):
    X = lambda a: rotate(a, 0)
    Y = lambda a: rotate(a, 1)
    Z = lambda a: rotate(a, 2)
    p = {"hips": rest["hips"] + q[:, :3]}
    local = {
        "hips": Y(q[:, 3]) @ Z(q[:, 4]) @ X(pelvic_share * q[:, 5]),
        "spine": X(q[:, 5] * (1 - pelvic_share) * 0.48) @ Z(q[:, 6] * 0.48),
        "chest": Y(q[:, 7])
        @ X(q[:, 5] * (1 - pelvic_share) * 0.52)
        @ Z(q[:, 6] * 0.52),
        "neck": Y(q[:, 9] * 0.40) @ X(q[:, 8] * 0.40) @ Z(q[:, 10] * 0.40),
        "head": Y(q[:, 9] * 0.60) @ X(q[:, 8] * 0.60) @ Z(q[:, 10] * 0.60),
    }
    world = {"hips": local["hips"]}

    def joint(name, parent, translation=None):
        p[name] = p[parent] + mul(
            world[parent], rest[name] if translation is None else translation
        )
        world[name] = world[parent] @ local[name] if name in local else world[parent]

    for name, parent in [
        ("spine", "hips"),
        ("chest", "spine"),
        ("upper_chest", "chest"),
        ("neck", "upper_chest"),
        ("head", "neck"),
    ]:
        joint(name, parent)
    joint("crest", "head", crown_offset)
    for side, sign, off in [("L", 1, 11), ("R", -1, 15)]:
        # Rz sets the actual horizontal glTF arm bind into the dependent arm frame.
        # Humeral twist orients the elbow plane, elbow flexion has only one signed DOF.
        upper, lower, hand = ("upper_arm." + side, "lower_arm." + side, "hand." + side)
        local[upper] = (
            X(-q[:, off + 1])
            @ Z(sign * q[:, off])
            @ Y(sign * q[:, off + 2])
            @ Z(np.full(len(q), -sign * np.pi / 2))
        )
        local[lower] = Y(-sign * q[:, off + 3])
        if side == "L":
            local[lower] = local[lower] @ X(q[:, 19])
            local[hand] = Z(q[:, 20]) @ Y(q[:, 21])
        joint("shoulder." + side, "upper_chest")
        joint(upper, "shoulder." + side)
        joint(lower, upper)
        joint(hand, lower)
        joint("finger_tip." + side, hand, np.array([sign * 0.130, -0.012, 0.004]))
        if side == "L":
            joint("left_finger", hand, np.array([0.104, -0.005, 0.012]))
        joint("upper_leg." + side, "hips")
        joint("eye." + side, "head")
    return p, local


def quaternions(matrix):
    r = Rotation.from_matrix(matrix).as_quat()
    r[1:] *= np.cumprod(np.where((r[1:] * r[:-1]).sum(axis=1) < 0.0, -1.0, 1.0))[
        :, None
    ]
    return r


def bake(review, camera, rest, placement, depths, heldout=()):
    excluded = set(heldout)
    rows = [
        {**row, "points": {}} if row["frame"] in excluded else row
        for row in review["rows"]
    ]
    n = len(rows)
    clip = review["clip"]
    if clip not in ("M01", "F01"):
        raise ValueError("No reviewed heading/contact model for " + clip)
    required = ["crest", "left_wrist", "right_wrist", "left_elbow", "right_elbow"]
    obs = {
        name: target_series(rows, name)
        for name in required
        + [
            "left_hip",
            "right_hip",
            "left_shoulder",
            "right_shoulder",
            "left_eye",
            "right_eye",
            "left_finger",
            "left_knee",
            "right_knee",
        ]
    }
    if min(np.mean(obs[k][1] > 0) for k in required) < 0.55:
        raise ValueError("Insufficient reviewed image support")
    if len(placement["shift"]) != n or len(depths) != n:
        raise ValueError("Timebase mismatch")
    # Tilt/scale stay fixed. The virtual crest is calibrated once from the opening,
    # accounting for the source hair silhouette that does not exist on the M3 mesh.
    a, b = obs["left_shoulder"], obs["right_shoulder"]
    mid = (a[0] + b[0]) / 2
    torso_ok = (a[1] > 0) & (b[1] > 0)
    crest, cw = obs["crest"]
    rel = mid - crest
    ref = torso_ok & (cw > 0) & (np.arange(n) < 30)
    if ref.sum() < 3:
        raise ValueError("Opening pose cannot calibrate head marker")
    offset_y = np.median(rel[ref, 1]) / camera["s"] - (
        rest["neck"][1]
        + rest["head"][1]
        - rest["shoulder.L"][1]
        - rest["upper_arm.L"][1]
    )
    crown = np.array([-np.median(rel[ref, 0]) / camera["s"], offset_y, -0.012])
    baselen = np.median(rel[ref, 1])
    ratio = fill_prior(rel[:, 1] / baselen, torso_ok & (cw > 0))
    shorten = np.arccos(np.clip(gaussian_filter1d(ratio, 3), 0.25, 1.0))
    if clip == "M01":
        spine_prior = np.clip(1.22 * shorten, 0.025, 0.86)
        head_prior = np.clip(0.90 * shorten, 0.035, 0.97)
    else:
        spine_prior = np.clip(0.20 * shorten, 0.01, 0.2)
        head_prior = np.clip(0.48 * shorten, 0.02, 0.48)
    zero = np.zeros(n)
    q = np.zeros((n, 22))
    q[:, 5] = spine_prior
    q[:, 8] = head_prior
    # The head looks toward the raised left hand in F01. Estimate *change* in
    # azimuth from the displacement of the nose relative to the eye midpoint.
    if clip == "F01":
        nose, nw = target_series(rows, "nose")
        eyes = (obs["left_eye"][0] + obs["right_eye"][0]) / 2
        ok = (nw > 0) & (obs["left_eye"][1] > 0) & (obs["right_eye"][1] > 0)
        yaw = fill_prior((nose[:, 0] - eyes[:, 0]) * 0.115, ok)
        q[:, 9] = np.clip(gaussian_filter1d(yaw, 4), -0.55, 0.85)
    for off in [11, 15]:
        q[:, off] = 0.17
        q[:, off + 1] = 0.05
        q[:, off + 2] = 0
        q[:, off + 3] = 0.33
    prior = q.copy()
    weights = np.array(
        [
            0.2,
            0.2,
            0.65,
            0.19,
            0.075,
            0.28,
            0.08,
            0.15,
            0.25,
            0.14,
            0.10,
            0.13,
            0.095,
            0.13,
            0.13,
            0.13,
            0.095,
            0.13,
            0.13,
            0.085,
            0.07,
            0.09,
        ]
    )
    # Bounds are local radian limits and metre offsets on these particular rigs.
    lo = np.array(
        [
            -0.25,
            -0.19,
            -0.11,
            -0.60,
            -0.26,
            -0.12,
            -0.38,
            -0.70,
            -0.28,
            -0.85,
            -0.55,
            -0.10,
            -0.55,
            -1.4,
            0.045,
            -0.10,
            -0.55,
            -1.4,
            0.045,
            -1.25,
            -1.10,
            -0.45,
        ]
    )
    hi = np.array(
        [
            0.25,
            0.04,
            0.14,
            0.60,
            0.26,
            0.80,
            0.38,
            0.70,
            1.10,
            0.85,
            0.55,
            1.75,
            1.55,
            1.4,
            2.44,
            1.75,
            1.55,
            1.4,
            2.44,
            1.25,
            1.10,
            0.45,
        ]
    )
    if clip == "M01":
        # Neutral and folded postures still carry weight on long, nearly
        # extended legs. Use the actual two-link knee fit below as well.
        lo[1] = -0.10
        hi[5] = 1.02
    bone = {"crest": "crest"}
    for side, suffix in [("left", "L"), ("right", "R")]:
        for part, r in [
            ("hip", "upper_leg"),
            ("shoulder", "upper_arm"),
            ("elbow", "lower_arm"),
            ("wrist", "hand"),
        ]:
            bone[side + "_" + part] = r + "." + suffix
    gain = {"hip": 1.65, "shoulder": 1.7, "elbow": 1.20, "wrist": 2.0, "crest": 1.4}
    depth = {}
    for name in bone:
        if name.endswith(("elbow", "wrist", "shoulder")):
            side = name.split("_")[0]

            def diff(row):
                j = row["estimated_world_joints"]
                base = j.get(side + "_shoulder")
                tip = j.get(name)
                return -(tip[2] - base[2]) if tip and base else np.nan

            z = np.array([diff(row) for row in depths])
            valid = np.isfinite(z) & (obs[name][1] > 0.55)
            z = gaussian_filter1d(median_filter(fill_prior(z, valid), size=9), 4)
            depth[name] = (z, valid)
    leg_targets = {}
    for i, (side, short) in enumerate([("left", "L"), ("right", "R")]):
        shoes = np.asarray(placement["feet"])[:, i]
        h = placement["height"]
        bind_knee = (
            rest["hips"] + rest["upper_leg." + short] + rest["lower_leg." + short]
        )
        bind_foot = bind_knee + rest["foot." + short]
        anchor = np.stack(
            [
                shoes[:, 0] * h,
                placement["ankleY"][i] + shoes[:, 2] * h,
                bind_foot[2] + shoes[:, 1] * h,
            ],
            axis=1,
        )
        pole = np.tile(bind_knee, (n, 1))
        sign = 1 if short == "L" else -1
        pole[:, 0] += h * (
            sign * 0.013
            + 0.44 * shoes[:, 0]
            + 0.09 * np.sin(shoes[:, 3])
            + sign * 0.85 * shoes[:, 2]
        )
        pole[:, 2] += h * 0.12
        leg_targets[side] = (
            anchor,
            pole,
            np.linalg.norm(rest["lower_leg." + short]),
            np.linalg.norm(rest["foot." + short]),
        )

    def residual(params):
        p, _ = pose(params, rest, crown, 0.55 if clip == "M01" else 0.0)
        terms = [(params - prior) * weights]
        for name, rig in bone.items():
            xy, vis = obs[name]
            err = (project(p[rig], camera) - xy) / camera["s"]
            g = gain[name.split("_")[-1]]
            # Soft-L1 robust reprojection keeps erroneous points from owning a limb.
            e = err / 0.06
            terms.append(
                g * np.sqrt(vis[:, None]) * err * np.sqrt(2 / (1 + np.sqrt(1 + e * e)))
            )
        for side, short in [("left", "L"), ("right", "R")]:
            origin = p["upper_leg." + short]
            anchor, pole, upper, lower = leg_targets[side]
            ray = anchor - origin
            length = np.linalg.norm(ray, axis=1)
            ray /= length[:, None]
            length = np.minimum(length, upper + lower - 0.0001)
            along = (upper * upper - lower * lower + length * length) / (2 * length)
            normal = pole - origin
            normal -= (normal * ray).sum(axis=1)[:, None] * ray
            normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-7)
            knee = (
                origin
                + along[:, None] * ray
                + np.sqrt(np.maximum(0.0, upper * upper - along * along))[:, None]
                * normal
            )
            xy, vis = obs[side + "_knee"]
            terms.append(
                0.95
                * np.sqrt(vis[:, None])
                * (project(knee, camera) - xy)
                / camera["s"]
            )
        if clip == "F01":
            # Visible wrist-to-finger screen direction constrains pronation and wrist flexion.
            finger, fw = obs["left_finger"]
            wrist, ww = obs["left_wrist"]
            delta = finger - wrist
            norm = np.linalg.norm(delta, axis=1)
            observed = delta / np.maximum(norm[:, None], 1.0)
            simulated = project(p["left_finger"], camera) - project(p["hand.L"], camera)
            span = np.linalg.norm(simulated, axis=1)
            direction = simulated / np.maximum(span[:, None], 1.0)
            terms.append(0.24 * (direction - observed) * np.sqrt(fw * ww)[:, None])
            terms.append(
                (0.4 * (span - np.clip(norm, 4.0, 19.0)) / camera["s"] * fw * ww)[
                    :, None
                ]
            )
        for name, (z, valid) in depth.items():
            side = name.split("_")[0]
            dz = p[bone[name]][:, 2] - p[bone[side + "_shoulder"]][:, 2]
            terms.append((0.15 * valid * np.clip(dz - z, -0.25, 0.25))[:, None])
        for side, sign in [("L", 1), ("R", -1)]:
            w = p["hand." + side]
            e = p["lower_arm." + side]
            hips = p["hips"]
            hsize = 0.130 if clip == "M01" else 0.115
            # Distal-limb clearance at the hip or ribcage, before mesh-level validation.
            for pt, radius in [(w, hsize + 0.055), (e, hsize + 0.012)]:
                rel = pt - hips
                front = np.clip((rel[:, 2] - 0.075) * 2.3, 0.0, 0.20)
                terms.append(
                    (5.0 * np.maximum(0.0, radius - sign * rel[:, 0] - front))[:, None]
                )
            if clip == "M01":
                # The Neurohacker cargo pocket projects beyond the thigh.
                # Keep the full hanging hand outside its swept envelope.
                for pt, radius in [(w, 0.251), (p["finger_tip." + side], 0.281)]:
                    rel = pt - hips
                    terms.append(
                        (14 * np.maximum(0.0, radius - sign * rel[:, 0]))[:, None]
                    )
            elif clip == "F01":
                # Allow the hand over the belt or in front of the raised arm.
                # Below the iliac crest keep the fingers beside the shorts.
                for pt, radius in [
                    (w, 0.20 if side == "R" else 0.164),
                    (p["finger_tip." + side], 0.248 if side == "R" else 0.205),
                ]:
                    rel = pt - hips
                    below = np.clip((0.085 - rel[:, 1]) / 0.075, 0.0, 1.0)
                    forward = np.maximum(0.0, rel[:, 2] - 0.14)
                    terms.append(
                        (
                            12
                            * below
                            * np.maximum(0.0, radius - sign * rel[:, 0] - forward)
                        )[:, None]
                    )
        return np.hstack(terms)

    # Block sparse damped least squares. Cross-frame velocity and acceleration
    # penalties apply during the solve rather than concealing jitter after playback.
    pcount = q.shape[1]
    d1 = sparse.diags([-np.ones(n - 1), np.ones(n - 1)], [0, 1], shape=(n - 1, n))
    d2 = sparse.diags(
        [np.ones(n - 2), -2 * np.ones(n - 2), np.ones(n - 2)],
        [0, 1, 2],
        shape=(n - 2, n),
    )
    smooth = sparse.kron(
        0.45 * (d1.T @ d1) + (32 if clip == "M01" else 6) * (d2.T @ d2),
        sparse.eye(pcount),
        format="csr",
    )
    for _ in range(35):
        r = residual(q)
        columns = []
        for j in range(pcount):
            change = q.copy()
            change[:, j] += 0.0002
            columns.append((residual(change) - r) / 0.0002)
        jac = np.stack(columns, axis=-1)
        normal = np.einsum("nki,nkj->nij", jac, jac)
        rhs = -np.einsum("nki,nk->ni", jac, r).ravel() - smooth @ q.ravel()
        A = (
            sparse.block_diag(normal, format="csr")
            + smooth
            + 0.008 * sparse.eye(q.size, format="csr")
        )
        step = spsolve(A, rhs).reshape(q.shape)
        new = np.clip(q + 0.70 * np.clip(step, -0.16, 0.16), lo, hi)
        if clip == "M01":
            # The observed vertical shortening is shared by the pelvis and
            # torso. Its upright part must not compensate entirely by squatting.
            minimum_y = -0.038 - 0.055 * np.clip(shorten / 0.85, 0.0, 1.0)
            new[:, 1] = np.maximum(new[:, 1], minimum_y)
        if np.max(np.abs(new - q)) < 0.0004:
            break
        q = new
    p, local = pose(q, rest, crown, 0.55 if clip == "M01" else 0.0)
    tracks = {}

    def track(name, data):
        # Preserve unit/slerp interpolation at 30 Hz; no per-frame key thinning.
        tracks[name] = dict(
            frames=list(range(n)), values=np.round(data, 5).ravel().tolist()
        )

    for name, R in local.items():
        track(name, quaternions(R))
    offsets = q[:, :3].copy()
    offsets[:, 0] -= np.asarray(placement["shift"]) * placement["height"]
    offsets[:, 1] += np.asarray(placement["drop"]) * placement["height"]
    track("hips.position", offsets)
    for side in ["L", "R"]:
        track("shoulder." + side, np.tile([0, 0, 0, 1], (n, 1)))
        # The briefcase is carried with the right grip throughout F01. On M01
        # loose finger flexion follows the hanging hand, not a synthetic fidget.
        val = np.full(n, 0.48 if clip == "F01" and side == "R" else 0.23)
        if clip == "F01" and side == "L":
            lift = np.clip(
                (obs["left_shoulder"][0][:, 1] + 40 - obs["left_wrist"][0][:, 1]) / 35,
                0,
                1,
            )
            lift = gaussian_filter1d(fill_prior(lift, obs["left_wrist"][1] > 0), 3)
            val = 0.32 - 0.19 * lift
        if side == "R":
            track("hand." + side, quaternions(rotate(zero, 0)))
        track("curl." + side, val)
    return dict(
        fps=30,
        sourceStartFrame=rows[0]["frame"],
        lastFrame=n - 1,
        sourceFrameCount=n,
        tracks=tracks,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("review", "camera", "rig", "placement", "world", "output"):
        parser.add_argument(arg, type=Path)
    parser.add_argument("--holdout-frames", type=Path, required=True)
    args = parser.parse_args()
    read = lambda p: json.loads(p.read_text())
    reviewed = read(args.review)
    motion = bake(
        reviewed,
        read(args.camera)[reviewed["clip"]],
        read_rest(args.rig),
        read(args.placement),
        read(args.world)["frames"],
        read(args.holdout_frames)[reviewed["clip"]],
    )
    args.output.write_text(json.dumps(motion, separators=(",", ":")) + "\n")
