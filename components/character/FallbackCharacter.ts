import * as THREE from "three";

export type FallbackCharacter = {
  root: THREE.Group;
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
};

const COLORS = {
  skin: 0xf0b7aa,
  hair: 0x241a2b,
  dark: 0x10111d,
};

export function createFallbackCharacter(): FallbackCharacter {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.55 });
  const outfit = new THREE.MeshStandardMaterial({ color: 0xc45ab7, emissive: 0x3c103d, emissiveIntensity: 0.28, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: 0.75 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.35, 6, 12), outfit);
  torso.position.y = 2.25;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), skin);
  head.position.y = 3.62;
  body.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  hairCap.position.set(0, 3.72, 0);
  hairCap.scale.set(1.04, 0.72, 1.02);
  body.add(hairCap);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.72), hair);
  visor.position.set(0, 3.62, 0.48);
  visor.rotation.x = -0.08;
  body.add(visor);

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x191321 });
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMaterial);
    eye.position.set(x, 3.52, 0.58);
    body.add(eye);
  }

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 18, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7d244d }));
  mouth.position.set(0, 3.34, 0.58);
  mouth.rotation.x = Math.PI / 2;
  body.add(mouth);

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const armGeometry = new THREE.CylinderGeometry(0.13, 0.16, 1.55, 10);
  const leftArmMesh = new THREE.Mesh(armGeometry, skin);
  const rightArmMesh = new THREE.Mesh(armGeometry, skin);
  leftArmMesh.position.y = -0.72;
  rightArmMesh.position.y = -0.72;
  leftArm.position.set(-0.72, 2.75, 0);
  rightArm.position.set(0.72, 2.75, 0);
  leftArm.add(leftArmMesh);
  rightArm.add(rightArmMesh);
  body.add(leftArm, rightArm);

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const legGeometry = new THREE.CylinderGeometry(0.18, 0.22, 1.8, 10);
  const leftLegMesh = new THREE.Mesh(legGeometry, dark);
  const rightLegMesh = new THREE.Mesh(legGeometry, dark);
  leftLegMesh.position.y = -0.9;
  rightLegMesh.position.y = -0.9;
  leftLeg.position.set(-0.32, 1.15, 0);
  rightLeg.position.set(0.32, 1.15, 0);
  leftLeg.add(leftLegMesh);
  rightLeg.add(rightLegMesh);
  body.add(leftLeg, rightLeg);

  root.scale.setScalar(0.78);
  return { root, body, leftArm, rightArm };
}

export function updateFallbackCharacter(character: FallbackCharacter, renderTimeSeconds: number) {
  const sway = Math.sin(renderTimeSeconds * 1.35);
  character.root.position.y = Math.abs(Math.sin(renderTimeSeconds * 1.05)) * 0.015;
  character.root.rotation.y = Math.sin(renderTimeSeconds * 0.42) * 0.035;
  character.body.rotation.z = sway * 0.012;
  character.leftArm.rotation.z = -0.2 - sway * 0.045;
  character.rightArm.rotation.z = 0.2 + sway * 0.045;
}
