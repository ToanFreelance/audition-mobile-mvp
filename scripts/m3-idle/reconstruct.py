"""Bake the two lobby clips. Run offline with MediaPipe 0.10.21, OpenCV and SciPy.
Usage: python reconstruct.py source.mp4 directory-with-family.glb output-directory
Pixel annotations are relative to the crops below. No runtime estimator or source video.
"""
import argparse
import json
import struct
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter
from scipy.spatial.transform import Rotation

# Anatomical left wrist, elbow, middle fingertip, nose. Occluded nose on
# male is replaced by a consistent forelock feature for measuring the dip.
FEMALE = [
 (0,80,99,96,85,66,103,67,39),(2.8,81,100,95,84,67,102,66,39),
 (3.3,90,93,100,80,74,100,67,38),(3.6,111,74,98,91,116,70,78,39),
 (3.9,116,68,105,85,125,57,85,40),(4.25,117,68,106,84,126,55,85,40),
 (5.4,115,69,104,87,121,60,87,43),(5.85,115,67,104,87,127,54,87,41),
 (6.4,113,70,104,89,124,55,88,44),(7.5,114,72,104,89,124,57,89,44),
 (7.85,118,82,101,87,128,72,86,46),(8.1,103,126,99,97,104,139,75,47),
 (8.4,94,119,97,91,88,133,72,47),(8.85,82,102,95,88,72,109,60,45),
 (9.3,77,98,94,81,65,103,65,41),(10.4,80,99,95,84,66,103,67,39)]
MALE = [
 (53.7,79,62),(54.6,75,63),(55,76,66),(55.2,81,67),(55.4,88,83),
 (55.6,90,103),(55.9,95,116),(56.3,96,112),(58,98,111),
 (60.5,100,108),(62.5,96,101),(62.8,94,91),(63,81,82),
 (63.3,81,64),(63.7,72,58),(64.8,79,62)]


def unit(v):
    return v / max(np.linalg.norm(v), 1e-8)


def turn(axis, radians):
    return Rotation.from_rotvec(unit(np.asarray(axis, dtype=float)) * radians)


def swing(a, b):
    a, b = unit(a), unit(b)
    cross = np.cross(a, b)
    return turn(cross, np.arctan2(np.linalg.norm(cross), a @ b))


def flow(frames, start, end, points):
    result = [np.array(points, dtype=np.float32)]
    step = 1 if end > start else -1
    for i in range(start, end, step):
        points = result[-1]
        moved, ok, _ = cv2.calcOpticalFlowPyrLK(frames[i], frames[i+step], points, None,
                                                winSize=(15, 15), maxLevel=2)
        result.append(np.where(ok.astype(bool), moved, points))
    return np.array(result)


def landmarks(video, female):
    rows = FEMALE if female else MALE
    first = round(rows[0][0]*30)
    n = round(rows[-1][0]*30)-first+1
    crop = np.array([390, 190] if female else [378, 125])
    video.set(cv2.CAP_PROP_POS_FRAMES, first)
    gray, observations = [], []
    with mp.solutions.pose.Pose(model_complexity=1, smooth_landmarks=False,
                                min_detection_confidence=.4, min_tracking_confidence=.45) as estimator:
        for _ in range(n):
            ok, frame = video.read()
            if not ok:
                raise ValueError("Truncated source performance")
            gray.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
            result = estimator.process(cv2.cvtColor(frame[110:485, 300:615], cv2.COLOR_BGR2RGB))
            if not result.pose_landmarks:
                raise ValueError("Missing landmarks: review input segment")
            obs = np.array([[300+p.x*315, 110+p.y*375, p.z*315] for p in result.pose_landmarks.landmark])
            observations.append(obs)
    trajectory = []
    for a, b in zip(rows, rows[1:]):
        i, j = round(a[0]*30)-first, round(b[0]*30)-first
        forward = flow(gray, i, j, np.reshape(a[1:], (-1, 2))+crop)
        backward = flow(gray, j, i, np.reshape(b[1:], (-1, 2))+crop)[::-1]
        mix = np.linspace(0, 1, j-i+1)[:, None, None]
        segment = (1-mix)*forward + mix*backward
        trajectory.extend(segment[:-1])
    trajectory.append(segment[-1])
    p = np.array(observations)
    # Reject reversed/folded shoulders on the caped male. Interpolate through
    # missing intervals in screen space, before deriving directions or timing.
    valid = p[:, 11, 0]-p[:, 12, 0] > (14 if female else 29)
    for j in range(33):
        for k in range(3):
            p[:, j, k] = np.interp(np.arange(n), np.flatnonzero(valid), p[valid, j, k])
    return (gaussian_filter1d(median_filter(p, size=(5, 1, 1)), 2.8, axis=0),
            gaussian_filter1d(trajectory, 1.8, axis=0), first)


def rig_offsets(path):
    data = path.read_bytes()
    model = json.loads(data[20:20+struct.unpack_from('<I', data, 12)[0]])
    return {n['name']: np.array(n.get('translation', [0, 0, 0])) for n in model['nodes']}


def bake(video, family, rig):
    female = family == 'drophunter'
    p, traced, start = landmarks(video, female)
    n = len(p)
    hips = (p[:, 23]+p[:, 24])/2
    shoulder = (p[:, 11]+p[:, 12])/2
    nose = traced[:, -1]
    # Image-depth estimates are unstable under hair/weapon occlusion. Constrain
    # the sagittal axis with silhouette and positive elbow flexion instead.
    hip_motion = gaussian_filter1d(hips-hips[:10].mean(0), 4, axis=0)
    dip = (nose[:, 1]-nose[:10, 1].mean()) / (52 if not female else 40)
    head_side = (nose[:, 0]-shoulder[:, 0])
    head_side = gaussian_filter1d(head_side, 2)
    shoulder_roll = np.arctan2(p[:, 12, 1]-p[:, 11, 1], p[:, 11, 0]-p[:, 12, 0])
    torso_yaw = gaussian_filter1d(np.arctan2(p[:, 11, 2]-p[:, 12, 2],
                                               p[:, 11, 0]-p[:, 12, 0]), 5)
    # Coordinates in the actual VRMs: +X = anatomical left, +Z = facing,
    # finger spread in XZ and left rest palm facing -Y. All angles below
    # are continuous functions of measured directions, including near holds.
    tracks = {}
    def record(key, v):
        tracks.setdefault(key, []).append(v)
    for i in range(n):
        lean = np.clip(dip[i], -.23, 1.12)
        roll = np.clip(shoulder_roll[i], -.24, .24)
        yaw = np.clip(torso_yaw[i]*.71, -.18, .66) if female else np.clip(torso_yaw[i]*.26, -.16, .16)
        side = np.clip(head_side[i]/22, -.68, .9)
        travel = np.clip(hip_motion[i, 0]/250, -.05, .10)
        record('hips.position', [travel*(.40 if female else .22)-(.013 if female else 0),
               -.014-min(.016,abs(travel)*.08)-(.011*lean if not female else 0), 0])
        parent = Rotation.identity()
        for bone, amount, pitch, tilt in [
            ('hips', .29, -.035*lean, -roll*.34), ('spine', .56, lean*(.055 if female else .18), roll*.24),
            ('chest', .86, lean*(.08 if female else .30), roll*.69),
            ('neck', 1.02, lean*(.14 if female else .55), roll*.80),
            ('head', 1.03, lean*(.25 if female else 1.0), roll*.72-side*.095)]:
            facing = yaw*amount + (side*(.25 if female else .15) if bone in ('neck','head') else 0)
            world = turn([0,1,0],facing)*turn([0,0,1],tilt)*turn([1,0,0],pitch)
            record(bone, (parent.inv()*world).as_quat()); parent = world
            if bone == 'chest':
                chest_rotation = world
        for s, suffix, sj in [(1,'L',11),(-1,'R',12)]:
            def bone_name(base):
                return base+'.'+suffix
            # Reconstruct gesture hand in shoulder-relative screen space.
            # The former bag arm follows the body's momentum with an open hand.
            gesturing = female and s==1
            if gesturing:
                wrist, elbow, finger = traced[i, :3]
                flex = np.clip((p[i,sj,1]+53-wrist[1])/48,0,1)
                dx, dy = elbow-p[i,sj,:2]
                upper_dir = unit(np.array([np.clip(dx/29,.22,.79),-max(.45,dy/31),-.14+.12*flex]))
                dx, dy = wrist-elbow
                lower_dir = unit(np.array([dx/24,-dy/24,.52+.28*flex]))
                palm_dir = unit(np.array([(finger[0]-wrist[0])/13, (wrist[1]-finger[1])/13,.16]))
            else:
                flex = 0
                # Match gravity in world space, let elbow and off-hand trail
                # the rotating trunk. Never aim towards the missing equipment.
                lag = max(0,i-4)
                swing_x = (hips[i,0]-hips[lag,0])/150
                upper_dir = unit(np.array([s*(.31 if female else .46)+swing_x,
                                            -1, -.12-lean*.09]))
                lower_dir = unit(np.array([s*(.10 if female else .16)+swing_x,-1,
                                            (.27 if female else .22)+.10*lean]))
                palm_dir = unit(lower_dir + np.array([-s*.12,0,-.055]))
            lift = (.18*flex if gesturing else -.05)-.08*lean
            clavicle = turn([0,0,1],s*lift)*turn([0,1,0],s*(.07-.15*flex))
            record(bone_name('shoulder'),clavicle.as_quat())
            parent = chest_rotation*clavicle
            # Swing from the bone's real child offset. Forearm roll is solved
            # in addition to swing so raising the forearm does not flip the palm.
            # Preserve the observed screen-space reach while moving the wrist
            # in front of the shirt when the elbow folds toward the hip.
            # Hanging arms stay outside the turning garment in its chest frame.
            if gesturing:
                local_upper = chest_rotation.inv().apply(upper_dir)
                local_upper[0] = max(.62, local_upper[0])
                local_upper[2] = max(.18+.40*(1-flex), local_upper[2])
                upper_dir = chest_rotation.apply(unit(local_upper))
                local_lower = chest_rotation.inv().apply(lower_dir)
                local_lower[2] = max(.58 + .56*(1-flex), local_lower[2])
                lower_dir = chest_rotation.apply(unit(local_lower))
            elif female:
                upper_dir = chest_rotation.apply(unit([s*(.45 if female else .33), -1, -.06]))
                lower_dir = chest_rotation.apply(unit([s*.14+swing_x, -1, .21+.12*lean]))
            upper = swing(rig[bone_name('lower_arm')],upper_dir)
            lower = swing(upper.apply(rig[bone_name('hand')]),lower_dir)*upper
            # Spread supination over the forearm. Swing the hand toward
            # the observed fingertips inside the wrist's anatomical cone.
            # A projected palm-normal constraint becomes singular during lift.
            lower = turn(lower_dir, s*flex*.56)*lower
            record(bone_name('upper_arm'),(parent.inv()*upper).as_quat())
            record(bone_name('lower_arm'),(upper.inv()*lower).as_quat())
            wrist_swing = swing(lower.apply(rig[bone_name('middle.proximal')]),palm_dir)
            arc = wrist_swing.as_rotvec()
            hand = Rotation.from_rotvec(unit(arc)*min(np.linalg.norm(arc), .63))*lower
            record(bone_name('hand'),(lower.inv()*hand).as_quat())
            # Common knuckle flex signal is expanded across the individual
            # phalanges at bind time. Avoid keeping the bag hand clenched.
            record(bone_name('curl'),[.25-.20*flex])
    # Close the short cut with a smooth overlap into moving samples from
    # the beginning. First and last velocity also agree at the repeat.
    packed = {}
    for name, samples in tracks.items():
        a=np.array(samples)
        is_rotation = a.shape[1]==4
        if is_rotation:
            for i in range(1,n):
                if a[i]@a[i-1]<0:
                    a[i]*=-1
            a=gaussian_filter1d(a, 1.7, axis=0)
            a/=np.linalg.norm(a,axis=1)[:,None]
        count=20
        for i in range(count):
            t=(i+1)/count
            mix=t*t*(3-2*t)
            first=a[0]+(i-count+1)*(a[1]-a[0])
            if is_rotation and first@a[-count+i]<0:
                first=-first
            a[-count+i]=(1-mix)*a[-count+i]+mix*first
        if is_rotation:
            a/=np.linalg.norm(a,axis=1)[:,None]
        # Keep samples whenever normalized linear interpolation would exceed
        # 0.22 degrees / 0.25mm. Endpoints and extrema survive decimation.
        keep={0,n-1}
        def simplify(lo,hi):
            if hi-lo<=1:return
            t=np.arange(1,hi-lo)[:,None]/(hi-lo)
            end=a[hi] if not is_rotation or a[hi]@a[lo]>=0 else -a[hi]
            approx=(1-t)*a[lo]+t*end
            actual=a[lo+1:hi]
            if is_rotation:
                approx/=np.linalg.norm(approx,axis=1)[:,None]
                errors=2*np.arccos(np.clip(abs((actual*approx).sum(axis=1)),0,1))
                tolerance=.0038
            else:
                errors=np.linalg.norm(actual-approx,axis=1)
                tolerance=.00025 if name.endswith('position') else .004
            j=np.argmax(errors)
            if errors[j]>tolerance:
                pivot=int(lo+1+j);keep.add(pivot);simplify(lo,pivot);simplify(pivot,hi)
        simplify(0,n-1)
        indices=sorted(keep)
        packed[name]={'frames':indices,'values':np.round(a[indices].flatten(),5).tolist()}
    return {'fps':30,'lastFrame':n-1,'sourceStartFrame':start,'tracks':packed}


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('source','rigs','out'):
        parser.add_argument(name,type=Path)
    args=parser.parse_args()
    cap=cv2.VideoCapture(str(args.source))
    for family in ['drophunter','neurohacker']:
        clip=bake(cap,family,rig_offsets(args.rigs/(family+'.glb')))
        (args.out/(family+'.json')).write_text(json.dumps(clip,separators=(',',':'))+'\n')
