"""Checks baked Blender data. Runtime parity and mesh checks are separate."""
import json
import math
import unittest
from pathlib import Path

ASSET=Path(__file__).resolve().parents[2]/'components/character/motion/drophunter.json'

class BlenderF01Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads(ASSET.read_text())

    def test_full_body_and_duration(self):
        data=self.data
        self.assertEqual(data['motionOwner'],'blender-full-body')
        self.assertEqual((data['fps'],data['lastFrame'],data['sourceFrameCount']),(30,312,313))
        for side in ['L','R']:
            for name in ['shoulder','upper_arm','lower_arm','hand','upper_leg','lower_leg','foot']:
                self.assertIn(name+'.'+side,data['tracks'])
        self.assertEqual(len(data['footSamples']),313)

    def test_unit_continuous_quaternions(self):
        for name,track in self.data['tracks'].items():
            self.assertEqual(track['frames'],list(range(313)),name)
            size=3 if name=='hips.position' else 4
            self.assertEqual(len(track['values']),313*size,name)
            self.assertTrue(all(math.isfinite(v) for v in track['values']),name)
            if size==3:
                continue
            quaternions=[track['values'][i:i+4] for i in range(0,len(track['values']),4)]
            for q in quaternions:
                self.assertLess(abs(sum(v*v for v in q)-1),1e-6,name)
            for a,b in zip(quaternions,quaternions[1:]):
                dot=sum(x*y for x,y in zip(a,b))
                self.assertGreater(dot,0,name)
                self.assertLess(math.degrees(2*math.acos(min(1,dot))),12,name)

    def test_contact_targets_stay_fixed(self):
        for side,letter in enumerate(['L','R']):
            for start,end in self.data['contactWindows'][letter]:
                anchor=self.data['footSamples'][start][side]
                for frame in range(start,end+1):
                    pos=self.data['footSamples'][frame][side]
                    self.assertLess(math.dist(anchor,pos),.001,(letter,frame))
        for frame in range(313):
            support=[any(a<=frame<=b for a,b in spans) for spans in self.data['contactWindows'].values()]
            self.assertTrue(any(support),frame)

if __name__=='__main__':
    unittest.main()
