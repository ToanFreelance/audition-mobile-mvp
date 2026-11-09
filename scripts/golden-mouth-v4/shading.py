"""Transport native custom normals with actual surface rotation; clay uses geometry only."""
import numpy as np
def geometric(q,f,g):
 t=q[f].astype(float);cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);n=np.zeros((g.max()+1,3))
 for j in range(3):np.add.at(n,g[f[:,j]],cross)
 return n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20)
def loop_normals(v,q,f,g,original,clay=False):
 n1=geometric(q,f,g)[g[f]].reshape(-1,3)
 if clay:return n1
 n0=geometric(v,f,g)[g[f]].reshape(-1,3);axis=np.cross(n0,n1);c=(n0*n1).sum(1)
 result=original+np.cross(axis,original)+np.cross(axis,np.cross(axis,original))/np.maximum(1+c[:,None],1e-6)
 result[c<-.99]=n1[c<-.99];return result/np.maximum(np.linalg.norm(result,axis=1)[:,None],1e-20)
