"""Blender background bake. Input is the unpolished output of reconstruct.py/library.py.
blender -b -P polish.py -- baseline_dir body_asset_cache output_dir F03 M03
Source time is in 30 Hz clip-local frames. Positions use the glTF rig axes.
"""
import bisect
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

# Source-matched guard and support accents. Hand channels are wrist displacement
# from the same-side shoulder, expressed in units of that rig's arm reach.
GUARD = [
    (0, -.12, -.16, .48, .04, -.17, .48),
    (41, -.11, -.12, .49, .05, -.14, .48),
    (56, -.03, -.01, .52, -.07, -.09, .50),
    (73, -.14, -.10, .55, -.07, -.06, .50),
    (91, -.27, .09, .51, -.13, .04, .54),
    (105, -.31, .25, .54, -.12, .15, .55),
    (119, -.20, .12, .53, -.08, .03, .53),
    (145, -.12, -.12, .51, -.05, -.08, .49),
    (164, -.20, -.03, .54, -.07, .12, .52),
    (188, -.12, -.12, .53, .03, -.14, .50),
    (229, -.12, -.16, .48, .04, -.17, .48),
]
# x/y displacements (m), forward body pitch, roll and yaw (rad). Depth is
# inferred. Preserve the original tracked gesture underneath the additive pass.
BODY = {
    'F01': [(0,-.006,-.005,.035,.04,-.043),(89,-.008,-.007,.045,.043,-.052),
            (104,.006,-.014,.066,-.008,-.085),(117,.014,.005,.014,-.038,.074),
            (135,.011,.002,.021,-.027,.052),(220,.009,-.003,.028,-.02,.042),
            (245,-.011,-.018,.082,.047,-.061),(267,-.008,-.005,.033,.044,-.051),(312,-.006,-.005,.035,.04,-.043)],
    'F02': [(0,-.007,-.014,.061,.045,-.10),(65,-.018,-.021,.074,.06,-.12),
            (100,.006,-.006,.038,-.015,.065),(140,.015,.003,.022,-.03,.09),
            (185,.003,-.011,.061,-.01,.023),(276,-.013,-.022,.078,.045,-.068),(411,-.007,-.014,.061,.045,-.10)],
    'F04': [(0,-.007,-.008,.055,.018,-.058),(27,.004,-.017,.087,-.015,-.091),
            (54,.013,-.008,.03,-.039,.044),(87,-.011,-.015,.079,.04,.066),
            (112,-.018,-.002,.026,.045,.093),(147,.004,.009,-.012,-.013,.069),
            (173,.008,-.012,.065,-.035,-.04),(204,-.011,-.015,.069,.04,-.069),(231,-.007,-.008,.055,.018,-.058)],
    'F05': [(0,-.008,-.004,.04,.034,-.068),(47,-.013,-.009,.054,.04,-.09),
            (76,-.017,-.012,.069,.038,-.107),(120,.008,-.004,.03,-.028,.03),
            (160,.018,.004,.014,-.046,.107),(198,.009,-.005,.045,-.016,.068),
            (239,-.012,-.012,.069,.038,-.073),(270,-.009,-.005,.045,.035,-.065),(306,-.008,-.004,.04,.034,-.068)],
    'M01': [(0,-.009,-.005,.055,.036,-.038),(38,-.003,-.004,.035,.017,.011),
            (52,.005,-.014,.12,-.016,.055),(73,.012,-.022,.19,-.033,.043),
            (99,.008,-.018,.165,-.025,.031),(254,.006,-.015,.145,-.018,.024),
            (274,-.004,-.006,.065,.018,-.015),(292,-.012,.002,.025,.04,-.044),(333,-.009,-.005,.055,.036,-.038)],
    'M02': [(0,-.014,-.026,.115,.082,-.087),(34,-.022,-.037,.155,.112,-.12),
            (71,-.006,-.019,.088,.052,-.037),(103,.019,-.032,.132,-.055,.065),
            (135,.008,-.022,.085,-.022,.031),(162,-.011,-.027,.122,.061,-.071),(180,-.014,-.026,.115,.082,-.087)],
    'X01': [(0,-.009,-.005,.045,.036,-.059),(43,-.015,-.009,.063,.049,-.088),
            (82,-.004,-.014,.085,.018,-.052),(119,.011,-.003,.028,-.031,.093),
            (157,.016,.002,.014,-.048,.124),(189,.004,-.007,.059,-.015,.035),(221,-.012,-.009,.060,.045,-.079),(242,-.009,-.005,.045,.036,-.059)],
    'F03': [(0,-.012,-.033,.16,.04,-.08),(39,-.023,-.045,.19,.06,-.11),
            (56,.024,-.014,.12,-.05,.05),(76,.005,-.046,.20,.01,-.07),
            (92,.038,-.024,.15,-.07,.07),(105,.045,.002,.09,-.08,.12),
            (129,.003,-.040,.18,.02,-.04),(153,-.024,-.054,.21,.08,-.09),
            (178,.010,-.028,.15,-.03,.025),(209,-.016,-.041,.19,.04,-.08),
            (229,-.012,-.033,.16,.04,-.08)],
    'M03': [(0,.003,.001,.025,.07,-.09),(26,.006,-.006,.04,.083,-.11),
            (45,.013,-.013,.06,.095,-.14),(70,.007,-.003,.015,.06,-.045),
            (87,.004,.002,-.008,.045,.02),(112,.005,-.001,.005,.052,.013),
            (138,.010,-.008,.037,.077,-.04),(164,.005,-.004,.04,.08,-.09),
            (193,.003,.001,.025,.07,-.09)],
}
axis = [Vector((1,0,0)), Vector((0,1,0)), Vector((0,0,1))]

# Keep the free left hand beside the belt while the right forearm opens.
BELT = [(0,.12,-.68,.30),(45,.09,-.62,.34),(82,.03,-.51,.37),
        (109,.04,-.50,.36),(153,.09,-.64,.32),(193,.12,-.68,.30)]

def controls(name, rows):
    action = bpy.data.actions.new(name)
    curves = []
    for i in range(1, len(rows[0])):
        curve = action.fcurves.new(data_path='["channel_%d"]' % i)
        for row in rows:
            point = curve.keyframe_points.insert(row[0], row[i])
            point.handle_left_type = point.handle_right_type = 'AUTO_CLAMPED'
        curve.update()
        curves.append(curve)
    return lambda frame: [curve.evaluate(frame) for curve in curves]

def sample(track, f, size):
    frames, values = track['frames'], track['values']
    a = max(0, bisect.bisect_right(frames,f)-1)
    b = min(len(frames)-1,a+1)
    def read(i):
        v = values[i*size:(i+1)*size]
        return Quaternion((v[3], *v[:3])).normalized() if size == 4 else Vector(v)
    u = (f-frames[a])/max(1,frames[b]-frames[a])
    return read(a).slerp(read(b),u) if size==4 else read(a).lerp(read(b),u)

def reduce_track(frames, values):
    """Keep the rendered slerp within 0.12 degrees and hips within 0.35 mm."""
    size = len(values)//len(frames)
    rows = [values[i:i+size] for i in range(0,len(values),size)]
    keep = {0,len(frames)-1}
    def split(a,b):
        if b-a<2:
            return
        worst = 0
        chosen = a
        for i in range(a+1,b):
            u=(frames[i]-frames[a])/(frames[b]-frames[a])
            if size==4:
                # The component order does not affect the spherical metric.
                estimate=Quaternion(rows[a]).normalized().slerp(Quaternion(rows[b]).normalized(),u)
                chord=min(sum((v-w)**2 for v,w in zip(estimate,rows[i])),
                          sum((v+w)**2 for v,w in zip(estimate,rows[i])))**.5
                error=4*math.asin(min(1,chord*.5))/.002
            else:
                error=math.dist(rows[i], [x+u*(y-x) for x,y in zip(rows[a],rows[b])])/.00035
            if error>worst:
                worst,chosen=error,i
        if worst>1:
            keep.add(chosen)
            split(a,chosen)
            split(chosen,b)
    split(0,len(frames)-1)
    ordered=sorted(keep)
    return {'frames':[frames[i] for i in ordered],'values':[x for i in ordered for x in rows[i]]}

def bake(key, baseline, assets, output):
    family = 'drophunter' if key[0]=='F' else 'neurohacker'
    name = {'F01':'drophunter','M01':'neurohacker'}.get(key,key)+'.json'
    clip = json.loads((baseline/name).read_text())
    raw = (assets/family/'body'/(family+'.vrm')).read_bytes()
    nodes = json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])['nodes']
    rest = {n['name']:Vector(n.get('translation',[0,0,0])) for n in nodes if 'name' in n}
    t = clip['tracks']
    body = controls(key+' support', BODY[key])
    guard = controls('Guard wrists', GUARD) if key=='F03' else None
    belt = controls('Belt wrist', BELT) if key=='M03' else None
    out = {}
    frames = list(range(0,clip['lastFrame'],2))+[clip['lastFrame']]
    for f in frames:
        x,y,p,r,h = body(f)
        q = {k:sample(v,f,4) for k,v in t.items() if len(v['values'])==4*len(v['frames'])}
        for joint,vals in [('hips',(.30*p,.38*h,.65*r)),('spine',(.44*p,.45*h,-.55*r)),
                           ('chest',(.26*p,.17*h,-.40*r)),('neck',(-.42*p,-.18*h,.14*r)),
                           ('head',(-.26*p,-.07*h,.13*r))]:
            for a,v in zip(axis,vals):
                q[joint] = Quaternion(a,v) @ q[joint]
        chest = q['hips'] @ q['spine'] @ q['chest']
        for side,sign,offset in [('R',-1,0),('L',1,3)]:
            shoulder,upper,fore,hand = [s+'.'+side for s in ('shoulder','upper_arm','lower_arm','hand')]
            q[shoulder] = Quaternion(axis[2],sign*(body(f-2)[2]*.24+body(f-2)[4]*.10)) @ q[shoulder]
            if guard or (belt and side=='L'):
                goal = Vector(guard(f)[offset:offset+3] if guard else belt(f))
                upper_axis,fore_axis=rest[fore],rest[hand]
                a,b=upper_axis.length,fore_axis.length
                goal *= a+b
                length=goal.length
                along=(a*a-b*b+length*length)/(2*length)
                direction=goal.normalized()
                pole=Vector((sign*.66,-.90,-.22))
                elbow=direction*along+(pole-direction*pole.dot(direction)).normalized()*max(0,a*a-along*along)**.5
                parent=chest @ q[shoulder]
                uq=upper_axis.rotation_difference(elbow)
                lq=(uq @ fore_axis).rotation_difference(goal-elbow) @ uq
                q[upper]=parent.inverted() @ uq
                q[fore]=uq.inverted() @ lq
                wrist_turn = .22+guard(f-3)[offset+1]*.42 if guard else -.16
                q[hand]=Quaternion(axis[1],sign*wrist_turn) @ q[hand]
            elif key not in ('F03','M03'):
                # Carry the source's chest turn through the shoulder first, the
                # arm next, and the wrist last. Keep the measured hand gesture.
                # The long logo-tee and cargo pockets occupy the hand path when
                # the relaxed male rolls his shoulder forward. Preserve wrist
                # timing, opening the shoulder away from the fabric.
                if key in ('M01','X01'):
                    q[upper] = Quaternion(axis[2],sign*(.15 if key=='M01' else .065)) @ q[upper]
                if key=='F04' and side=='R':
                    q[upper] = Quaternion(axis[0],-.16) @ q[upper]
                prior = body(f-3)
                trailing = body(f-5)
                q[upper] = Quaternion(axis[2], (prior[3]-r)*.85) @ q[upper]
                q[fore] = Quaternion(axis[1], (prior[4]-h)*.64) @ q[fore]
                q[hand] = Quaternion(axis[1], (trailing[4]-h)*1.12) @ q[hand]
            elif key=='M03':
                q[hand]=Quaternion(axis[0],body(f-3)[4]*(1.2 if side=='R' else .35)) @ q[hand]
        pos=sample(t['hips.position'],f,3)+Vector((x,y,-p*.065))
        values={k:[v.x,v.y,v.z,v.w] for k,v in q.items()}
        values['hips.position']=list(pos)
        if guard:
            for side in ['L','R']:
                values['curl.'+side]=[.78]
        for k,v in values.items():
            seq=out.setdefault(k,[])
            if len(v)==4 and seq and sum(a*b for a,b in zip(seq[-4:],v))<0:
                v=[-a for a in v]
            seq.extend(round(a,5) for a in v)
    for k,v in out.items():
        t[k]=reduce_track(frames,v)
    (output/name).write_text(json.dumps(clip,separators=(',',':'))+'\n')

base,assets,out,*ids=sys.argv[sys.argv.index('--')+1:]
for key in ids:
    bake(key,Path(base),Path(assets),Path(out))
