"""Bind-derived original shoe vertex measurements. Does not rewrite geometry."""
import numpy as np


class SoleGeometry:
    def __init__(self,g):
        self.g=g; skin=g.doc['skins'][0];self.joints=skin['joints']
        self.ibm=g.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        self.parts={}; self.floors={}; rest=g.fk()
        for side in ['Left','Right']:
            ji=[i for i,j in enumerate(self.joints) if g.doc['nodes'][j].get('name','') in ['mixamorig:'+side+'Foot','mixamorig:'+side+'ToeBase']]
            pieces=[]
            for mesh in g.doc['meshes']:
                for pr in mesh['primitives']:
                    at=pr['attributes']; p=g.accessor(at['POSITION']);j=g.accessor(at['JOINTS_0']);w=g.accessor(at['WEIGHTS_0'])
                    selected=(w*np.isin(j,ji)).sum(1)>.1
                    pieces.append((np.c_[p[selected],np.ones(selected.sum())],j[selected],w[selected]))
            self.parts[side]=pieces
            ankle=rest[g.names['mixamorig:'+side+'Foot']][1,3]
            self.floors[side]=float(ankle-self.minimum(rest,[side])+.002)

    def minimum(self,world,parts=None):
        matrices=np.array([world[j]@ib for j,ib in zip(self.joints,self.ibm)])
        return min(float(np.einsum('nkij,nj,nk->ni',matrices[j],p,w)[:,1].min())
                   for side in (parts or self.parts) for p,j,w in self.parts[side] if len(p))
