import tempfile,unittest
from pathlib import Path
import numpy as np
from acquire import parse_bvh,select

class Tests(unittest.TestCase):
    def test_fk_intrinsic_channels(self):
        text='HIERARCHY\nROOT Hips { OFFSET 0 0 0 CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation JOINT Child { OFFSET 1 0 0 CHANNELS 3 Zrotation Xrotation Yrotation End Site { OFFSET 1 0 0 } } }\nMOTION\nFrames: 2\nFrame Time: 0.1\n0 0 0 0 0 0 0 0 0\n2 3 0 90 0 0 0 0 0\n'
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'t.bvh';p.write_text(text);nodes,v,pos,dt=parse_bvh(p)
            np.testing.assert_allclose(pos[1,1],[2,4,0],atol=1e-6)
            self.assertEqual(len(nodes),3)
    def test_bad_frame_count_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'t.bvh';p.write_text('HIERARCHY ROOT Hips { OFFSET 0 0 0 CHANNELS 3 Zrotation Xrotation Yrotation } MOTION Frames: 3 Frame Time: 0.1 0 0 0')
            with self.assertRaises(AssertionError):parse_bvh(p)
    def test_selection_excludes_mixed_and_pose(self):
        x=select('Subject #15 (dance)\n15_04 dance, household\nSubject #93 (dance)\n93_01 Motorcycle Pose\n93_03 charleston_01\nSubject #94 (indian dance)\n94_01 Unknown')
        self.assertEqual([m['source_id'] for m in x],['93_03','94_01'])
    def test_non_dance_not_selected(self):
        self.assertFalse(select('Subject #1\n01_01 walking'))

if __name__=='__main__':unittest.main()
