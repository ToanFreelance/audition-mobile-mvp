import unittest
import numpy as np
from scipy.spatial.transform import Rotation as R
from solve_target import bounded_normal,frame
from moonlight_source import EVENTS,RANGES
from moonlight_delivery import runs

class MoonlightTests(unittest.TestCase):
    def test_low_confidence_half_open_ranges(self):
        self.assertEqual(runs([]), [])
        self.assertEqual(runs([76,77,79,80,81,176]), [[76,78],[79,82],[176,177]])

    def test_complete_distinct_intervals(self):
        self.assertEqual(len(set(RANGES)),8)
        for key,a,b in RANGES:
            self.assertIn(a,EVENTS[key]);self.assertIn(b,EVENTS[key]);self.assertLess(a,b);self.assertLess(b,750)
        self.assertEqual(sum(b-a for _,a,b in RANGES),811)
        self.assertNotIn(278,EVENTS['B'])

    def test_body_anchored_roll_stops_half_turn(self):
        primary=np.array([0.,-1,0]);reference=np.array([1.,0,0])
        for angle in np.linspace(-179,179,33):
            measured=R.from_rotvec(primary*np.deg2rad(angle)).apply(reference)
            n=bounded_normal(primary,measured,reference,35)
            actual=np.rad2deg(np.arctan2(np.dot(np.cross(reference,n),primary),np.dot(reference,n)))
            self.assertLessEqual(abs(actual),35.000001)
            self.assertAlmostEqual(np.dot(n,primary),0)
            np.testing.assert_allclose(frame(primary,n).T@frame(primary,n),np.eye(3),atol=1e-8)

if __name__=='__main__':unittest.main()
