"""Focused numerical tests independent of large source assets."""
import unittest
import numpy as np
from solve_target import ik2,unit,frame,transported_normal


class CoreTests(unittest.TestCase):
    def test_ik_lengths_and_plane(self):
        a=np.array([0.,0,0]);end=np.array([.2,.6,.1]);pole=np.array([.4,.1,.3])
        elbow,wrist=ik2(a,end,pole,.5,.4)
        self.assertAlmostEqual(np.linalg.norm(elbow-a),.5,places=8)
        self.assertAlmostEqual(np.linalg.norm(wrist-elbow),.4,places=8)
        np.testing.assert_allclose(wrist,end,atol=1e-8)
        axis=unit(end-a);v=elbow-axis*np.dot(elbow,axis);p=pole-axis*np.dot(pole,axis)
        self.assertGreater(np.dot(v,p),0)

    def test_reach_clamp(self):
        e,w=ik2(np.zeros(3),np.array([10.,0,0]),np.array([0,1.,0]),.5,.4)
        self.assertLess(np.linalg.norm(w),.9)
        self.assertAlmostEqual(np.linalg.norm(w-e),.4,places=8)

    def test_orthonormal_frame(self):
        m=frame([.1,.4,.2],[.4,.2,-.1])
        np.testing.assert_allclose(m.T@m,np.eye(3),atol=1e-8)
        self.assertAlmostEqual(np.linalg.det(m),1)

    def test_twist_continuity(self):
        n=transported_normal(np.array([0.,1,0]),np.array([0,0,1.]),np.array([1.,0,0]),np.array([1.,0,0]))
        angle=np.arccos(np.clip(np.dot(n,[1,0,0]),-1,1))
        self.assertLessEqual(angle,np.deg2rad(8)+1e-9)


if __name__=='__main__':unittest.main()
