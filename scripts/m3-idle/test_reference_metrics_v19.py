"""V1.9 proof that projection score is sensitive to real motion errors."""
import importlib.util
import pathlib
import unittest

path=pathlib.Path(__file__).with_name("reference_metrics_v19.py")
module_spec=importlib.util.spec_from_file_location("reference_metrics_v19",path)
m=importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(m)

BASE={
"left_shoulder":(95,105),"right_shoulder":(135,105),
"left_elbow":(87,131),"right_elbow":(145,132),
"left_wrist":(86,159),"right_wrist":(149,160),
"left_hip":(103,160),"right_hip":(128,161),
"left_knee":(100,194),"right_knee":(130,195),
"left_ankle":(98,229),"right_ankle":(132,228)}
def sequence(scale=1.,shift=(0,0),bad=None,occluded=False):
    frames=[]
    for i in range(35):
        joints={name:[(x+.19*i)*scale+shift[0],(y+.04*i)*scale+shift[1],
                     .05 if occluded and i==24 and name=="left_wrist" else 1.]
                for name,(x,y) in BASE.items()}
        if i==20 and bad: joints[bad][0]+=13
        frames.append({"frame":768+i,"time":i/30,"joints":joints})
    return {"schema":"m3-v19-2d","clip":"F03","fps":30.,"width":910,
            "height":512,"frames":frames}
class MeasuredMotionTests(unittest.TestCase):
    def test_fixed_calibration_compensates_camera_not_motion(self):
        report,frames=m.compare(sequence(),sequence(.5,(250,90)))
        self.assertLess(report["error_px"]["max"],1e-7)
    def test_deviating_wrist_is_caught_at_exact_frame(self):
        report,frames=m.compare(sequence(),sequence(.5,(250,90),bad="left_wrist"))
        self.assertGreater(frames[20]["error_px"]["left_wrist"],20)
        self.assertLess(frames[21]["error_px"]["left_wrist"],1e-6)
    def test_occlusion_is_not_fabricated(self):
        report,frames=m.compare(sequence(occluded=True),sequence(.5,(250,90)))
        self.assertNotIn("left_wrist",frames[24]["error_px"])
        self.assertLess(report["coverage"]["left_wrist"],1)
    def test_frame_drift_cannot_be_hidden(self):
        source,target=sequence(),sequence()
        target["frames"][8]["time"]+=.04
        with self.assertRaisesRegex(ValueError,"timestamps"):m.compare(source,target)
    def test_wrong_clip_is_rejected(self):
        source,target=sequence(),sequence()
        target["clip"]="M03"
        with self.assertRaisesRegex(ValueError,"mismatch"):m.compare(source,target)
if __name__=="__main__": unittest.main()
