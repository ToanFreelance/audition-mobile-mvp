import * as T from "three";

/** Diagnostic projection only. Does not emulate WebGL materials or skinned meshes. */
export class CanvasSourcePreview {
  readonly domElement = document.createElement("canvas");
  private readonly ctx = this.domElement.getContext("2d")!;
  private ratio = 1;
  private width = 1;
  private height = 1;
  outputColorSpace: string = T.SRGBColorSpace;
  setPixelRatio(ratio: number) { this.ratio = ratio; }
  setSize(width: number, height: number, _updateStyle = false) {
    this.width = width; this.height = height;
    this.domElement.width = width * this.ratio; this.domElement.height = height * this.ratio;
  }
  dispose() {}
  render(scene: T.Scene, camera: T.Camera) {
    const ctx = this.ctx, width = this.width, height = this.height;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.fillStyle = "#0c101a"; ctx.fillRect(0, 0, width, height);
    camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
    const project = (p: T.Vector3) => { const v = p.clone().project(camera); return { x: (v.x + 1) * width / 2, y: (1 - v.y) * height / 2, z: v.z }; };
    const ring = (radius: number, color: string, fill = false) => {
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) { const angle = i * Math.PI / 48; const p = project(new T.Vector3(Math.cos(angle) * radius, -0.01, Math.sin(angle) * radius)); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      ctx.closePath(); if (fill) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.stroke(); }
    };
    ring(1.8, "#1c2233", true); ring(1.35, "#8972bb"); ring(0.14, "#60e3bb");
    const body = scene.getObjectByName("QA-V2-bones") as T.InstancedMesh | undefined;
    const joints = scene.getObjectByName("QA-V2-joints") as T.InstancedMesh | undefined;
    const draw: { z: number; paint(): void }[] = [];
    if (body?.visible) for (let i = 0; i < body.count; i++) {
      const m = new T.Matrix4(); body.getMatrixAt(i, m); m.premultiply(body.matrixWorld);
      const a = project(new T.Vector3(0, -0.5, 0).applyMatrix4(m)), b = project(new T.Vector3(0, 0.5, 0).applyMatrix4(m));
      draw.push({ z: (a.z + b.z) / 2, paint() { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = "#c5b2f1"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(3, height * 0.009); ctx.stroke(); } });
    }
    if (joints?.visible) for (let i = 0; i < joints.count; i++) {
      const m = new T.Matrix4(); joints.getMatrixAt(i, m); m.premultiply(joints.matrixWorld);
      const p = project(new T.Vector3().setFromMatrixPosition(m));
      const radius = Math.max(2.2, new T.Vector3().setFromMatrixScale(m).x * height * 0.006);
      draw.push({ z: p.z, paint() { ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fillStyle = "#f1e7ff"; ctx.fill(); } });
    }
    draw.sort((a, b) => b.z - a.z).forEach(item => item.paint());
    ctx.fillStyle = "#8992aa"; ctx.font = "10px Arial"; ctx.textAlign = "center";
    ctx.fillText("CHIẾU SKELETON 2D · WEBGL KHÔNG KHẢ DỤNG", width / 2, 22);
  }
}
