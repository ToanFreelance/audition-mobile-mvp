"""Unit tests for V1.9.1 monocular 3D-estimate audit (no private video)."""
import unittest
import world_estimates_v191 as m
from reference_metrics_v19 import JOINTS

LOCATIONS={
    "left_shoulder":(.2,-.4,0), "right_shoulder":(-.2,-.4,0),
    "left_elbow":(.3,-.15,-.01), "right_elbow":(-.3,-.15,-.01),
    "left_wrist":(.4,.02,-.06), "right_wrist":(-.4,.02,-.06),
    "left_hip":(.15,0,0), "right_hip":(-.15,0,0),
    "left_knee":(.16,.4,-.03), "right_knee":(-.16,.4,-.03),
    "left_ankle":(.17,.8,-.05), "right_ankle":(-.17,.8,-.05),
}


def sample_frames(n=45):
    return [{"frame":1000+i, "estimated_world_joints":{
        name:[*pos,.98] for name,pos in LOCATIONS.items()}}
        for i in range(n)]


class WorldEstimateAuditTests(unittest.TestCase):
    def test_stationary_bones_are_detected_but_not_retarget_certified(self):
        report=m.audit_world("F03",sample_frames())
        self.assertEqual(report["jump_count"],0)
        self.assertEqual(report["mean_world_joint_coverage"],1.0)
        self.assertFalse(report["retarget_ready"])
        self.assertEqual(report["length_variation_review"],[])

    def test_unstable_forearm_length_is_flagged(self):
        frames=sample_frames()
        for i in range(15,30):
            frames[i]["estimated_world_joints"]["left_wrist"][0] += .45
        report=m.audit_world("F03",frames)
        self.assertIn("forearm_L",report["length_variation_review"])
        self.assertGreater(report["jump_count"],0)
        self.assertFalse(report["retarget_ready"])

    def test_missing_source_world_pose_is_failure_not_interpolated(self):
        frames=sample_frames()
        for row in frames:row["estimated_world_joints"]={}
        report=m.audit_world("M02",frames)
        self.assertEqual(report["mean_world_joint_coverage"],0.0)
        self.assertFalse(report["tracking_sufficient"])
        self.assertFalse(report["retarget_ready"])
        self.assertIsNone(report["limbs"]["forearm_L"]["median_estimated_world_units"])

    def test_missing_wrist_is_excluded_from_arm_length(self):
        frames=sample_frames()
        for row in frames[:20]:row["estimated_world_joints"].pop("left_wrist")
        report=m.audit_world("X01",frames)
        self.assertEqual(report["limbs"]["forearm_L"]["observations"],25)
        self.assertLess(report["mean_world_joint_coverage"],1.0)


if __name__ == "__main__":
    unittest.main()
