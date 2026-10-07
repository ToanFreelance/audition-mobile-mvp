import copy
import hashlib
import unittest
import numpy as np
from curate_v2 import EXTRA, blob_hash, signature
from publish_v2 import csv_row, validate
from review_decisions_v2 import RETAINED, EXCLUDED, partner_required


class CurationTests(unittest.TestCase):
    def row(self):
        return dict(id='cmu-test',stylePrimary='pop_casual',status='A',retained=True,
            partnerDependency='NONE',duplicateRelation='UNIQUE',reviewScope=dict(ownerAccepted=False),
            notes='Source review only',visualStatus='SOURCE_KEYPOSES_REVIEWED',roleHints=['normal'],
            energy='MEDIUM',floorWork='STANDING',retargetRisk='MED',duplicateOf=None,
            sha256='abc',duration=1,fps=120)

    def test_git_blob_hash(self):
        self.assertEqual(blob_hash(b'hello\n'),hashlib.sha1(b'blob 6\0hello\n').hexdigest())

    def test_extra_selection(self):
        self.assertEqual(len(EXTRA),41); self.assertEqual(len(set(EXTRA)),41)
        self.assertIn('90_32',EXTRA); self.assertNotIn('87_02',EXTRA)

    def test_valid_schema(self):
        validate([self.row()])

    def test_partner_not_normal(self):
        m=self.row(); m['partnerDependency']='REQUIRED'
        with self.assertRaises(AssertionError): validate([m])
        self.assertTrue(partner_required('93_06'))
        self.assertFalse(partner_required('93_03'))

    def test_duplicates_not_retained(self):
        m=self.row(); m['duplicateOf']='cmu-other'
        with self.assertRaises(AssertionError): validate([m])

    def test_reject_needs_reason(self):
        m=self.row(); m.update(status='REJECT',retained=False,rejectionReason=None)
        with self.assertRaises(AssertionError): validate([m])

    def test_no_auto_acceptance(self):
        m=self.row(); m['reviewScope']['ownerAccepted']=True
        with self.assertRaises(AssertionError): validate([m])

    def test_signature_scale_translation_and_reference_exclusion(self):
        names=['Hips','LeftUpLeg','RightUpLeg','Head']
        nodes=[dict(name=n) for n in names]
        p=np.tile(np.array([[0.,1.,0.],[.2,.8,0.],[-.2,.8,0.],[0.,2.,0.]]),(8,1,1))
        p[2:,3,0]=np.arange(6)*.02
        original=p.copy(); a=signature(nodes,p)
        np.testing.assert_allclose(a,signature(nodes,p*3+10),atol=1e-12)
        p[0,:,0]+=100  # reference choreography excluded; height remains the normalization anchor
        np.testing.assert_allclose(a,signature(nodes,p))
        np.testing.assert_array_equal(original[1:],p[1:])

    def test_csv_filters_nested_hierarchy(self):
        m=self.row(); m.update(hierarchy=[dict(name='Hips')],styleSecondary=['party_reaction'])
        row=csv_row(m)
        self.assertNotIn('hierarchy',row); self.assertEqual(row['styleSecondary'],'party_reaction')

    def test_editorial_inventory_explicit_unique(self):
        retained=[]
        for style,text in RETAINED.items():
            for line in text.strip().splitlines():
                self.assertEqual(len(line.split('|')),6)
                retained.append(line.split('|')[0])
        excluded=[line.split('|')[0] for line in EXCLUDED.strip().splitlines()]
        self.assertEqual(len(retained),73)
        self.assertEqual(len(retained+excluded),153)
        self.assertEqual(len(set(retained+excluded)),153)


if __name__=='__main__': unittest.main()
