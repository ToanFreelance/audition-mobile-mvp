import copy, unittest
from motion_jobs import review
from motion_extract import quality_flags
from solve_target import bind_normal_at_direction,ik2
import numpy as np


class JobTests(unittest.TestCase):
    def setUp(self):
        self.a=dict(source=dict(analysisFrames=750),lanes=[dict(id='lane-3')],motions=[dict(sourceMotionId='candidate-1',type='normal',include=True,reviewed=True,startFrame=290,endFrame=391,selectedDancer='lane-3',evidenceNote='',bothBoundariesObserved=True)])
    def changed(self,**patch):
        d=copy.deepcopy(self.a['motions']);d[0].update(patch);return d
    def test_normal(self):self.assertAlmostEqual(review(self.a,self.a['motions'])[0]['duration'],101/30)
    def test_finish_evidence(self):
        with self.assertRaisesRegex(ValueError,'FINISH_SOURCE'):review(self.a,self.changed(type='finish'))
    def test_finish_source_review(self):self.assertEqual(review(self.a,self.changed(type='finish',evidenceNote='FINISH banner verified'))[0]['type'],'finish')
    def test_unknown(self):
        with self.assertRaisesRegex(ValueError,'REVIEW_REQUIRED'):review(self.a,self.changed(type='unknown'))
    def test_unreviewed(self):
        with self.assertRaisesRegex(ValueError,'REVIEW_REQUIRED'):review(self.a,self.changed(reviewed=False))
    def test_eof(self):
        with self.assertRaisesRegex(ValueError,'INCOMPLETE'):review(self.a,self.changed(endFrame=750,evidenceNote='EOF cannot be evidence'))
    def test_dancer(self):
        with self.assertRaisesRegex(ValueError,'UNKNOWN_DANCER'):review(self.a,self.changed(selectedDancer='lane-x'))
    def test_integer_frame(self):
        with self.assertRaisesRegex(ValueError,'INVALID_FRAME'):review(self.a,self.changed(startFrame=290.2))
    def test_edit_evidence(self):
        with self.assertRaisesRegex(ValueError,'EDITED_BOUNDARY'):review(self.a,self.changed(startFrame=289))
    def test_reject(self):self.assertFalse(review(self.a,self.changed(type='reject'))[0]['include'])
    def test_duplicate(self):
        self.a['motions'].append({**self.a['motions'][0],'sourceMotionId':'candidate-2'})
        with self.assertRaisesRegex(ValueError,'DUPLICATE'):review(self.a,[self.a['motions'][0]]*2)
    def test_overlap(self):
        self.a['motions'].append({**self.a['motions'][0],'sourceMotionId':'candidate-2'})
        with self.assertRaisesRegex(ValueError,'OVERLAPPING'):review(self.a,self.a['motions'])


class V21Tests(unittest.TestCase):
    def test_bind_plane(self):
        n=bind_normal_at_direction(np.array([0.,1,0]),np.array([1.,0,0]),np.array([1.,0,0]))
        self.assertAlmostEqual(np.dot(n,[1,0,0]),0,places=8)
    def test_deep_knee_lengths(self):
        a=np.zeros(3);e,w=ik2(a,np.array([.05,.08,0]),np.array([0,0,1.]),.4,.4,170)
        self.assertAlmostEqual(np.linalg.norm(e),.4);self.assertAlmostEqual(np.linalg.norm(w-e),.4)
    def test_structural_pass_not_fidelity(self):
        q=dict(structural_pass=True,animations=[dict(name='finish-special-001',angular_warning=False,sampled_skinning_min_y_m=.002,root_xyz_range=[2,1,0])])
        m=dict(id='finish-special-001',sourceMotionId='c',type='finish')
        self.assertEqual(quality_flags(m,[q])['qaStatus'],'FAIL')


if __name__=='__main__':unittest.main()
