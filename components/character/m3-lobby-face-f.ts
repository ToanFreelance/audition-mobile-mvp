import * as THREE from "three";

// Match the accepted local unlit-face shader used by Creator preset F.
// Keep the global Waiting Room stage renderer/tone mapping untouched.
const facialSculptCompile: THREE.Material["onBeforeCompile"] = shader => {
  shader.vertexShader = "varying vec3 vM3FaceNormal;\n" + shader.vertexShader.replace(
    "#include <defaultnormal_vertex>",
    "#include <defaultnormal_vertex>\nvM3FaceNormal = normalize( transformedNormal );",
  );
  shader.fragmentShader = "varying vec3 vM3FaceNormal;\n" + shader.fragmentShader.replace(
    "#include <color_fragment>",
    "#include <color_fragment>\n" +
    "float m3Facing = max(dot(normalize(vM3FaceNormal), normalize(vec3(-0.22, 0.32, 0.92))), 0.0);\n" +
    "float m3FaceShade = mix(0.84, 1.025, smoothstep(0.05, 0.94, m3Facing));\n" +
    "diffuseColor.rgb *= m3FaceShade;",
  );
};

export function applyM3WaitingRoomFacialF(actor: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  const neutralFaceTint = new THREE.Color(0xfaffff);
  actor.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !/^head.*baked/i.test(mesh.name)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (seen.has(material)) continue;
      seen.add(material);
      const basic = material as THREE.MeshBasicMaterial;
      if (!basic.isMeshBasicMaterial) continue;
      basic.color.multiply(neutralFaceTint);
      basic.onBeforeCompile = facialSculptCompile;
      basic.needsUpdate = true;
    }
  });
}
