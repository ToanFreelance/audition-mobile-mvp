import unittest
import numpy as np
from mixamo_finish import swing
from solve_target import ik2
class MixamoFinishTests(unittest.TestCase):
    def test_rest_axis_swing(self):
        a=np.array([1.,0,0]);b=np.array([0.,1,0]);m=swing(a,b)
        np.testing.assert_allclose(m@a,b,atol=1e-7);np.testing.assert_allclose(m.T@m,np.eye(3),atol=1e-7);self.assertAlmostEqual(np.linalg.det(m),1)
    def test_identical_axis(self):np.testing.assert_array_equal(swing(np.array([0.,1,0]),np.array([0.,1,0])),np.eye(3))
    def test_inverted_hand_support_ik_lengths(self):
        a=np.array([0.,.6,0]);end=np.array([.1,.04,.1]);pole=np.array([.35,.35,0]);mid,solved=ik2(a,end,pole,.31,.29,max_flex=175)
        self.assertAlmostEqual(np.linalg.norm(mid-a),.31);self.assertAlmostEqual(np.linalg.norm(solved-mid),.29);np.testing.assert_allclose(solved,end,atol=1e-7)
if __name__=='__main__':unittest.main()
