"""Bake seven additional image-tracked performances. Needs the dependencies of reconstruct.py."""
import argparse
import json
from pathlib import Path
import cv2
import mediapipe as mp
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import gaussian_filter1d, median_filter
from reconstruct import rig_offsets, swing, turn, unit
from scipy.spatial.transform import Rotation

# Frame-inclusive windows omit dissolves and the black tail.
WINDOWS = {'F02':(348,759),'F03':(768,997),'F04':(1020,1251),'F05':(1287,1593),
           'M02':(1980,2160),'X01':(2198,2440),'M03':(2466,2659)}
# Pixel landmarks for the nonhuman bear and the mainly occluded weapon arm.
# Nose, L/R shoulders, elbows, wrists and hips in screen order.
GUIDES = {
 'M02':[(450,178),(501,219),(389,224),(531,227),(366,289),(521,169),(395,326),(486,340),(414,342)],
 'X01':[(453,241),(475,256),(438,254),(477,280),(432,282),(472,301),(428,303),(469,310),(444,310)]}
# Frame, anatomical R wrist (x,y), anatomical L wrist (x,y).
# Read from the reference grid where props or hair confuse the pose detector.
WRISTS = {
 'F02':[(348,417,300,486,299),(399,418,296,487,277),(445,418,299,488,248),
        (504,423,290,481,270),(535,423,288,477,291),(645,415,300,487,298),(759,417,300,487,298)],
 'F04':[(1020,437,284,500,323),(1076,441,293,467,302),(1120,448,282,467,291),
        (1168,450,267,462,278),(1197,444,278,483,298),(1220,436,287,501,321),(1251,437,286,500,321)],
 'M03':[(2466,427,250,487,291),(2504,405,256,490,290),(2532,385,210,486,276),
        (2543,385,203,486,269),(2581,387,214,489,272),(2620,426,251,486,287),(2659,426,251,486,290)]}
def observations(cap,key):
    start,end=WINDOWS[key]
    cap.set(cv2.CAP_PROP_POS_FRAMES,start)
    points=[]; tracked=[]; previous=None
    with mp.solutions.pose.Pose(model_complexity=1,smooth_landmarks=False,min_detection_confidence=.35) as estimator:
        for frame in range(start,end+1):
            ok,img=cap.read()
            if not ok: raise ValueError(frame)
            gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
            if key in GUIDES:
                if previous is None: xy=np.array(GUIDES[key],np.float32)
                else:
                    new,status,_=cv2.calcOpticalFlowPyrLK(previous,gray,xy,None,winSize=(19,19),maxLevel=3)
                    xy=np.where(status,new,xy)
                tracked.append(xy.copy());previous=gray
            out=estimator.process(cv2.cvtColor(img[40:490,295:625],cv2.COLOR_BGR2RGB))
            points.append([[295+p.x*330,40+p.y*450,p.z*330] for p in out.pose_landmarks.landmark] if out.pose_landmarks else np.full((33,3),np.nan))
    p=np.array(points)
    if key in GUIDES:
        for k,j in enumerate([0,11,12,13,14,15,16,23,24]):
            p[:,j,:2]=np.array(tracked)[:,k];p[:,j,2]=0
    good=(p[:,11,0]-p[:,12,0])>4
    if not good.any(): raise ValueError('No reliable shoulder pair '+key)
    for j in [0,11,12,13,14,15,16,23,24]:
        for k in range(3):p[:,j,k]=np.interp(np.arange(len(p)),np.where(good)[0],p[good,j,k])
    if key in WRISTS:
        samples=np.array(WRISTS[key])
        for j,col in [(16,1),(15,3)]:
            p[:,j,:2]=PchipInterpolator(samples[:,0],samples[:,col:col+2])(np.arange(start,end+1))
    return gaussian_filter1d(median_filter(p,size=(5,1,1)),2,axis=0)

def bake(p,key,rig):
    h=(p[:,23]+p[:,24])/2;c=(p[:,11]+p[:,12])/2
    length=max(25,np.median(h[:,1]-c[:,1]));tracks={}
    def add(name,values):tracks.setdefault(name,[]).append(values)
    for i,pose in enumerate(p):
        lateral=np.clip((c[i,0]-h[i,0])/length,-.45,.45)
        shoulder=pose[11]-pose[12]
        yaw=np.clip(np.arctan2(shoulder[2],shoulder[0]),-.75,.75)
        tilt=np.clip(-shoulder[1]/length,-.4,.4)
        gaze=np.clip((pose[0,0]-c[i,0])/length,-.5,.5)
        pitch=np.clip((pose[0,1]-c[i,1])/length+.55,-.30,.52)
        if key=='M02':
            # The bear shifts its muzzle and shoulder girdle under a heavy load.
            # Both depth signs below are inferred from the screen-space head turn.
            lateral+=np.clip((h[i,0]-np.median(h[:,0]))/length,-.15,.15)
            yaw+=np.clip((pose[0,0]-np.median(p[:,0,0]))/length*1.6,-.42,.42)
        parent=Rotation.identity()
        for name,weight in [('hips',.22),('spine',.5),('chest',.85),('neck',1),('head',1.05)]:
            world=turn([0,1,0],yaw*weight+(gaze if name=='head' else 0))*turn([0,0,1],weight*(tilt-lateral)*.65)*turn([1,0,0],pitch*weight)
            add(name,(parent.inv()*world).as_quat());parent=world
            if name=='chest':chest=world
        add('hips.position',[np.clip((h[i,0]-np.median(h[:,0]))/length*.18,-.065,.065),np.clip((np.median(h[:,1])-h[i,1])/length*.12,-.06,.025),0])
        for sign,side,s,e,w in [(1,'L',11,13,15),(-1,'R',12,14,16)]:
            upper=pose[e]-pose[s];fore=pose[w]-pose[e]
            u=unit([sign*max(.31,sign*upper[0]/length),-upper[1]/length,max(.05,-upper[2]/length*.24)])
            # Project the empty hand in front of the chest for cross-body reaches.
            v=unit([fore[0]/length,-fore[1]/length,max(.24 if sign*fore[0]>0 else .49,-fore[2]/length*.34)])
            if key=='M02' and side=='L':
                # Empty-hand adaptation: rest the hand beside the shoulder.
                v=unit([-.36,.63,.26])
            lift=np.clip((pose[s,1]-pose[w,1])/length+.4,0,1)
            clav=turn([0,0,1],sign*(lift*.15-.045))
            if key in ('F04','M03'):
                # Fit the projected shoulder-to-wrist vector, including reach.
                # Independent directions lose elbow flexion when a hand approaches the face.
                span=sum(np.linalg.norm(rig[b+'.'+side]) for b in ['lower_arm','hand'])
                pixel_scale=sum(rig[b][1] for b in ['spine','chest','shoulder.'+side])/length
                delta=pose[w]-pose[s]
                goal=np.array([delta[0]*pixel_scale,-delta[1]*pixel_scale,span*.46])
                shoulder_to_hand=unit(goal)
                reach=np.clip(np.linalg.norm(goal),span*.20,span*.92)
                goal=shoulder_to_hand*reach
                upper_len=np.linalg.norm(rig['lower_arm.'+side]);fore_len=np.linalg.norm(rig['hand.'+side])
                along=(upper_len**2-fore_len**2+reach**2)/(2*reach)
                pole=np.array([sign*.65,-.88,-.32])
                elbow=shoulder_to_hand*along+unit(pole-shoulder_to_hand*(pole@shoulder_to_hand))*np.sqrt(max(0,upper_len**2-along**2))
                u=chest.inv().apply(unit(elbow));v=chest.inv().apply(unit(goal-elbow))
            uq=chest*swing(rig['lower_arm.'+side],u)
            lq=swing(uq.apply(rig['hand.'+side]),chest.apply(v))*uq
            lq=turn(chest.apply(v),sign*lift*.38)*lq
            add('shoulder.'+side,clav.as_quat());add('upper_arm.'+side,((chest*clav).inv()*uq).as_quat())
            add('lower_arm.'+side,(uq.inv()*lq).as_quat())
            add('hand.'+side,turn([0,0,1],sign*(.14+.14*lift)).as_quat());add('curl.'+side,[.22-.15*lift])
    out={}
    for name,seq in tracks.items():
        a=np.array(seq)
        if a.shape[1]==4:
            for i in range(1,len(a)):
                if a[i]@a[i-1]<0:a[i]*=-1
            a=gaussian_filter1d(a,2.6 if 'arm' in name else 1.4,axis=0)
            a/=np.linalg.norm(a,axis=1)[:,None]
        # Playback bridges the measured last pose into the next entry.
        ix=np.unique(np.r_[np.arange(0,len(a),3),len(a)-1])
        out[name]={'frames':ix.tolist(),'values':a[ix].round(5).flatten().tolist()}
    return dict(fps=30,lastFrame=len(p)-1,sourceStartFrame=WINDOWS[key][0],tracks=out)
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for arg in ['video','rigs','output']:parser.add_argument(arg,type=Path)
    a=parser.parse_args(); cap=cv2.VideoCapture(str(a.video))
    for key in WINDOWS:
        family='drophunter' if key.startswith('F') else 'neurohacker'
        data=bake(observations(cap,key),key,rig_offsets(a.rigs/(family+'.glb')))
        (a.output/(key+'.json')).write_text(json.dumps(data,separators=(',',':'))+'\n')
        print(key,flush=True)
