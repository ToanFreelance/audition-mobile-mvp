import unittest
import numpy as np
from scipy.spatial.transform import Rotation
from review_tracks_v191 import propagate
from solve_reviewed_v191 import bake, project, quaternions, target_series


class ReviewedFitTests(unittest.TestCase):
    def test_mask_does_not_create_measurements_inside_a_gap(self):
        rows = [
            {"points": {"hand": [3, 7, 0.8]}},
            {"points": {}},
            {"points": {"hand": [5, 9, 0.9]}},
        ]
        _, weight = target_series(rows, "hand")
        np.testing.assert_allclose(weight, [0.8, 0, 0.9])

    def test_unseeded_bear_cannot_generate_human_points_or_motion(self):
        frames = [np.zeros((24, 24), np.uint8) for _ in range(3)]
        self.assertEqual(propagate(frames, {}, 1980), [{}, {}, {}])
        with self.assertRaisesRegex(ValueError, "No reviewed heading"):
            bake(
                {"clip": "M02", "rows": [{"frame": 1980, "points": {}}]},
                {},
                {},
                {},
                [{}],
            )

    def test_heldout_evidence_cannot_open_the_coverage_gate(self):
        rows = [
            {
                "frame": i,
                "points": {
                    n: [40, 80, 1.0]
                    for n in [
                        "crest",
                        "left_wrist",
                        "right_wrist",
                        "left_elbow",
                        "right_elbow",
                    ]
                },
            }
            for i in range(10)
        ]
        with self.assertRaisesRegex(ValueError, "Insufficient reviewed"):
            bake({"clip": "F01", "rows": rows}, {}, {}, {}, [{}] * 10, range(10))

    def test_fixed_camera_preserves_world_scale_and_axis(self):
        cam = dict(s=100.0, ox=30.0, oy=40.0, tilt=0.0)
        np.testing.assert_allclose(
            project(np.array([[0, 0, 0], [1, 1, 0]]), cam), [[30, 40], [130, -60]]
        )

    def test_baked_rotation_sign_is_continuous_across_pi(self):
        rotations = Rotation.from_euler(
            "y", np.array([173, 179, 181, 187])[:, None], degrees=True
        ).as_matrix()
        q = quaternions(rotations)
        self.assertTrue(np.all((q[1:] * q[:-1]).sum(axis=1) > 0.99))
        np.testing.assert_allclose(
            Rotation.from_quat(q).as_matrix(), rotations, atol=1e-10
        )
