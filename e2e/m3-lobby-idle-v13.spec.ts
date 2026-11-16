import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { createM3LobbyIdle } from "../components/character/m3-lobby-idle";

function syntheticM3Actor() {
  const root = new THREE.Group();
  const bones: THREE.Bone[] = [];
  const bone = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const b = new THREE.Bone();
    b.name = name; b.position.set(x, y, z); parent.add(b); bones.push(b); return b;
  };
  const hips = bone("hips", root, 0, 0.85);
  const spine = bone("spine", hips, 0, 0.27);
  const chest = bone("chest", spine, 0, 0.13);
  const neck = bone("neck", chest, 0, 0.15);
  bone("head", neck, 0, 0.12);
  for (const side of [-1, 1]) {
    const suffix = side > 0 ? "L" : "R";
    // M3 VRMs bind in a T-pose, with the fingers along lateral X.
    const clavicle = bone("shoulder." + suffix, chest, side * 0.02, 0.12);
    const upper = bone("upper_arm." + suffix, clavicle, side * 0.10, 0.003);
    const lower = bone("lower_arm." + suffix, upper, side * 0.20, 0, -0.009);
    bone("hand." + suffix, lower, side * 0.18, 0, 0.009);
    const thigh = bone("upper_leg." + suffix, hips, side * 0.09, -0.05);
    const shin = bone("lower_leg." + suffix, thigh, 0, -0.32);
    bone("foot." + suffix, shin, 0, -0.415, -0.046);
  }
  const geometry = new THREE.BoxGeometry(0.40, 1.68, 0.2);
  const vertexCount = geometry.getAttribute("position").count;
  const boneIndices = new Uint16Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) weights[i * 4] = 1;
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(boneIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const skinned = new THREE.SkinnedMesh(
    geometry, new THREE.MeshBasicMaterial({ color: 0x999999 }),
  );
  skinned.position.y = 0.85;
  root.add(skinned);
  root.updateWorldMatrix(true, true);
  skinned.bind(new THREE.Skeleton(bones));
  return { root, bones };
}

test("V1.7 female: keyframed open-palm acknowledgement preserves foot contacts", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "host-female", "fixture-1", "drophunter");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  expect(runtime.animationProfile).toBe("female-relaxed-greeting");
  expect(runtime.clipDuration).toBeCloseTo(10.4, 3);
  const feet = bones.filter(b => b.name.startsWith("foot."));
  const anchors = feet.map(b => root.worldToLocal(b.getWorldPosition(new THREE.Vector3())));
  const originalRoot = root.position.clone();
  const wrists = bones.filter(b => b.name.startsWith("upper_arm.") || b.name.startsWith("lower_arm."));
  const restAngles = wrists.map(w => w.quaternion.clone());
  let biggestArmTurn = 0;
  for (let i = 0; i < 1200; i++) {
    runtime.update(1 / 30);
    const twist = Math.max(...wrists.map((w, j) => w.quaternion.angleTo(restAngles[j])));
    biggestArmTurn = Math.max(biggestArmTurn, twist);
    if (i % 60 === 0) {
      for (let j = 0; j < feet.length; j++) {
        const goal = root.localToWorld(anchors[j].clone());
        expect(feet[j].getWorldPosition(new THREE.Vector3()).distanceTo(goal)).toBeLessThan(.012);
      }
      for (const b of bones) {
        expect(Number.isFinite(b.quaternion.w)).toBe(true);
        expect(b.quaternion.length()).toBeCloseTo(1, 4);
      }
    }
  }
  expect(biggestArmTurn).toBeGreaterThan(.22);
  expect(runtime.maxFootDrift).toBeLessThan(.012);
  expect(root.position.equals(originalRoot)).toBe(true);
  expect(runtime.completedGestures).toBeGreaterThanOrEqual(3);
  runtime.dispose();
});

test("V1.7 male: neck-led sleepy hold and recovery without torso overfold", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "guest-male", "fixture-1", "neurohacker");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  expect(runtime.animationProfile).toBe("male-neck-led-slump");
  expect(runtime.clipDuration).toBeCloseTo(11.1, 3);
  const head = bones.find(b => b.name === "head")!;
  const spine = bones.find(b => b.name === "spine")!;
  let maxHead = 0, maxTorso = 0, slumpedFrames = 0, awakeAgain = false;
  for (let i = 0; i < 660; i++) {
    runtime.update(1 / 30);
    const headAngle = head.quaternion.angleTo(new THREE.Quaternion());
    const torsoAngle = spine.quaternion.angleTo(new THREE.Quaternion());
    maxHead = Math.max(headAngle, maxHead);
    maxTorso = Math.max(torsoAngle, maxTorso);
    if (runtime.poseTime > 3 && runtime.poseTime < 7 && headAngle > .35) slumpedFrames++;
    if (runtime.elapsedSeconds > 9.7 && headAngle < .18) awakeAgain = true;
  }
  expect(maxHead).toBeGreaterThan(.42);
  expect(maxTorso).toBeGreaterThan(.12);
  expect(slumpedFrames).toBeGreaterThan(50);
  expect(awakeAgain).toBe(true);
  expect(runtime.maxFootDrift).toBeLessThan(.012);
  runtime.dispose();
});

test("V1.7 M3 clip identity comes from explicit catalog rigFamily, not player name", () => {
  const female = createM3LobbyIdle(syntheticM3Actor().root, "Boy", "fixture-2", "drophunter");
  const male = createM3LobbyIdle(syntheticM3Actor().root, "Grace", "fixture-2", "neurohacker");
  expect(female?.animationProfile).toBe("female-relaxed-greeting");
  expect(male?.animationProfile).toBe("male-neck-led-slump");
  expect(female?.clipDuration).not.toBe(male?.clipDuration);
  female?.dispose();
  male?.dispose();
});

test("V1.7 planted feet follow formation translation, yaw and scale changes", () => {
  const { root, bones } = syntheticM3Actor();
  root.scale.setScalar(2.35);
  root.position.set(1.2, 0.3, -0.8);
  root.rotation.y = 0.42;
  root.updateWorldMatrix(true, true);
  const feet = bones.filter(b => b.name.startsWith("foot."));
  const runtime = createM3LobbyIdle(root, "member-3", "room-qa", "drophunter");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  runtime.update(1 / 30);
  // V1.7 deliberately adjusts the female stance ONCE before recording
  // the planted anchors. Compare against those accepted stance positions.
  const anchors = feet.map(foot => root.worldToLocal(foot.getWorldPosition(new THREE.Vector3())));
  for (let i = 0; i < 900; i++) {
    if (i === 350) {
      root.position.x += 0.45;
      root.rotation.y += 0.34;
      root.scale.setScalar(2.0);
      root.updateWorldMatrix(true, true);
    }
    runtime.update(1 / 30);
    if (i % 45 !== 0) continue;
    for (let k = 0; k < feet.length; k++) {
      const goal = root.localToWorld(anchors[k].clone());
      expect(feet[k].getWorldPosition(new THREE.Vector3()).distanceTo(goal)).toBeLessThan(.015);
    }
  }
  expect(runtime.maxFootDrift).toBeLessThan(.015);
  runtime.dispose();
});


test("V1.7 rendered-pose proxy: no forearm crosses torso center during either full clip", () => {
  for (const rig of ["drophunter","neurohacker"] as const) {
    const { root, bones }=syntheticM3Actor();
    const runtime=createM3LobbyIdle(root,rig+"-clearance","fixture-clearance",rig);
    expect(runtime).not.toBeNull();
    if(!runtime)continue;
    const bone=(name:string)=>bones.find(b=>b.name===name)!;
    const leftElbow=bone("lower_arm.L"),rightElbow=bone("lower_arm.R");
    const leftHand=bone("hand.L"),rightHand=bone("hand.R");
    const hips=bone("hips"),leftShoulder=bone("upper_arm.L"),rightShoulder=bone("upper_arm.R");
    let minimum=Infinity;
    for(let i=0;i<Math.ceil(runtime.clipDuration*30)+2;i++){
      runtime.update(1/30);
      root.updateWorldMatrix(true,true);
      const pelvis=hips.getWorldPosition(new THREE.Vector3());
      const chest=leftShoulder.getWorldPosition(new THREE.Vector3()).add(
        rightShoulder.getWorldPosition(new THREE.Vector3())
      ).multiplyScalar(.5);
      const axis=chest.clone().sub(pelvis);
      for(const [forearm,wrist] of [[leftElbow,leftHand],[rightElbow,rightHand]]) {
        const elbow=forearm.getWorldPosition(new THREE.Vector3());
        const hand=wrist.getWorldPosition(new THREE.Vector3());
        for(const fraction of [0,.25,.5,.75,1]) {
          const point=elbow.clone().lerp(hand,fraction);
          const t=THREE.MathUtils.clamp(point.clone().sub(pelvis).dot(axis)/Math.max(axis.lengthSq(),1e-8),0,1);
          minimum=Math.min(minimum,point.distanceTo(pelvis.clone().addScaledVector(axis,t)));
        }
      }
    }
    // Skeletal proxy only. Outfit skinned meshes still require actual rendered QA.
    expect(minimum).toBeGreaterThan(.055);
    expect(runtime.maxFootDrift).toBeLessThan(.012);
    runtime.dispose();
  }
});

test("V1.7 actual clip playback has continuous wrists and a closed loop on both rigs", () => {
  for (const family of ["drophunter", "neurohacker"] as const) {
    const {root, bones} = syntheticM3Actor();
    const idle = createM3LobbyIdle(root, "loop-check", "QA", family)!;
    const initial = bones.map(bone => bone.quaternion.clone());
    const previous = initial.map(q => q.clone());
    let largestStep = 0;
    for (let i = 0; i < Math.round(idle.clipDuration * 30); i++) {
      idle.update(1 / 30);
      for (const [index, bone] of bones.entries()) {
        largestStep = Math.max(largestStep, previous[index].angleTo(bone.quaternion));
        previous[index].copy(bone.quaternion);
      }
    }
    expect(largestStep).toBeLessThan(0.40);
    for (const [index, bone] of bones.entries()) {
      expect(initial[index].angleTo(bone.quaternion)).toBeLessThan(.002);
    }
    idle.dispose();
  }
});
