"""Offline V1.9.1 source-tracking audit tests; no owner source MP4 needed."""
import json
import tempfile
from pathlib import Path
import unittest

import reference_metrics_v191 as m
import reference_metrics_v19 as v19


def fake_source(occlusion=False, reversal=False):
    frames = []
    for n in range(35):
        s = {}
        for joint in v19.JOINTS:
            x = (125 if "left" in joint else 90) + n * .15
            y = 100 if "shoulder" in joint else 135 if "elbow" in joint else 165
            if "hip" in joint: y = 190
            if "knee" in joint: y = 245
            if "ankle" in joint: y = 302
            s[joint] = [x, y, .91]
        if occlusion and n == 10:
            del s["left_wrist"]
        if reversal and n >= 18:
            s["left_shoulder"][0], s["right_shoulder"][0] = (
                s["right_shoulder"][0], s["left_shoulder"][0])
        frames.append({"frame": 768+n, "time": round(n/30,6), "joints":s})
    return {"clip":"F03","fps":30,"frames":frames}


class NineClipTrackingTests(unittest.TestCase):
    def test_all_nine_motion_assets_have_distinct_ordered_windows(self):
        windows = m.existing_clip_windows()
        self.assertEqual(set(windows), set(m.CLIP_ASSETS))
        self.assertEqual(windows["F03"], (768, 997))
        self.assertEqual(windows["M03"], (2466, 2659))
        previous = -1
        for start, end in windows.values():
            self.assertGreater(start, previous)
            self.assertGreaterEqual(end, start)
            previous = end

    def test_coverage_is_measured_and_occlusion_stays_missing(self):
        report = m.inspect_landmarks(fake_source(occlusion=True))
        self.assertEqual(report["coverage"]["left_wrist"]["missing"], 1)
        self.assertEqual(report["coverage"]["right_wrist"]["missing"], 0)
        self.assertEqual(report["coverage"]["left_wrist"]["tracked"], 34)
        self.assertFalse(report["source_bounds_verified"])
        self.assertEqual(report["retargeting"], "NOT_PERFORMED")

    def test_source_frame_alignment_cannot_drift(self):
        data = fake_source()
        data["frames"][14]["time"] += .04
        with self.assertRaisesRegex(ValueError, "misaligned"):
            m.inspect_landmarks(data)

    def test_sudden_left_right_flip_is_flagged_not_silently_repaired(self):
        report = m.inspect_landmarks(fake_source(reversal=True))
        self.assertTrue(any(w["kind"] == "left_right_reversal"
                            for w in report["review_flags"]))

    def test_rois_require_every_clip_and_numeric_crops(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "roi.json"
            p.write_text(json.dumps({"F03":[300,110,315,375]}))
            with self.assertRaisesRegex(ValueError, "all nine"):
                m.parse_rois(p, m.existing_clip_windows())
            p.write_text(json.dumps({k:[300,110,315,375]
                                     for k in m.CLIP_ASSETS}))
            self.assertEqual(len(m.parse_rois(p,m.existing_clip_windows())),9)

    def test_no_landmark_confidence_is_invented(self):
        x = fake_source()
        for frame in x["frames"]: frame["joints"].pop("left_ankle")
        report = m.inspect_landmarks(x)
        self.assertIsNone(report["coverage"]["left_ankle"]["median_visibility"])
        self.assertEqual(report["coverage"]["left_ankle"]["fraction"], 0)


if __name__ == "__main__":
    unittest.main()
