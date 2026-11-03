import * as THREE from "three";

/**
 * Local-only animation QA for the independent Fashion A+B sample viewer.
 * Not connected to gameplay timing or the project's AnimationMixer authority.
 */
export type QaMotion =
  | "off" | "suite" | "blink" | "smile" | "angry" | "eye-look" | "mouth"
  | "head-nod" | "head-shake" | "head-tilt" | "idle" | "step" | "wave";

export const QA_MOTIONS: ReadonlyArray<{ id: QaMotion; name: string; group: "face" | "head" | "body" | "all" }> = [
  { id: "suite", name: "▶ Chạy QA tổng hợp", group: "all" },
  { id: "blink", name: "Chớp mắt", group: "face" },
  { id: "smile", name: "Mỉm cười", group: "face" },
  { id: "angry", name: "Nhíu mày", group: "face" },
  { id: "eye-look", name: "Đảo mắt", group: "face" },
  { id: "mouth", name: "Mở / khép miệng", group: "face" },
  { id: "head-nod", name: "Gật đầu", group: "head" },
  { id: "head-shake", name: "Lắc đầu", group: "head" },
  { id: "head-tilt", name: "Nghiêng đầu", group: "head" },
  { id: "idle", name: "Idle sway", group: "body" },
  { id: "step", name: "Bước tại chỗ", group: "body" },
  { id: "wave", name: "Vẫy tay", group: "body" },
];

type Expression = "blink" | "smile" | "angry" | "lookLeft" | "lookRight" | "lookUp" | "lookDown" | "mouth";
type MorphRef = { mesh: THREE.Mesh; index: number; weight: number };
type VrMGroup = { name?: string; presetName?: string; binds?: Array<{ mesh: number; index: number; weight?: number }> };
type ParserLike = {
  json?: {
    extensions?: { VRM?: { blendShapeMaster?: { blendShapeGroups?: VrMGroup[] } } };
  };
  associations?: Map<THREE.Object3D, { meshes?: number }>;
};

function expressionOf(name: string): Expression | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/blink|eyeclose|eyelidclose/.test(key)) return "blink";
  if (/joy|happy|smile/.test(key)) return "smile";
  if (/angry|frown/.test(key)) return "angry";
  if (/lookleft/.test(key)) return "lookLeft";
  if (/lookright/.test(key)) return "lookRight";
  if (/lookup/.test(key)) return "lookUp";
  if (/lookdown/.test(key)) return "lookDown";
  if (/^a$|^aa$|moutha|mouthopen|jawopen|fclmtha/.test(key)) return "mouth";
  return null;
}

function findBone(bones: THREE.Bone[], kind: string): THREE.Bone | null {
  const patterns: Record<string, RegExp[]> = {
    head: [/J_Bip_C_Head$/i, /(?:^|[_-])Head$/i],
    neck: [/J_Bip_C_Neck$/i, /(?:^|[_-])Neck$/i],
    chest: [/J_Bip_C_Chest$/i, /J_Bip_C_UpperChest$/i, /(?:^|[_-])Spine2$/i],
    hips: [/J_Bip_C_Hips$/i, /(?:^|[_-])Hips$/i],
    leftArm: [/J_Bip_L_UpperArm$/i, /(?:^|[_-])LeftUpperArm$/i],
    rightArm: [/J_Bip_R_UpperArm$/i, /(?:^|[_-])RightUpperArm$/i],
    leftLeg: [/J_Bip_L_UpperLeg$/i, /(?:^|[_-])LeftUpperLeg$/i],
    rightLeg: [/J_Bip_R_UpperLeg$/i, /(?:^|[_-])RightUpperLeg$/i],
  };
  for (const pattern of patterns[kind] ?? []) {
    const bone = bones.find((candidate) => pattern.test(candidate.name));
    if (bone) return bone;
  }
  return null;
}

/** Rest-pose procedural motion: no cumulative offsets, no replacement global turns. */
export class CharacterAnimationQa {
  private elapsed = 0;
  private motion: QaMotion = "off";
  private bones = new Map<string, THREE.Bone>();
  private rest = new Map<THREE.Bone, THREE.Quaternion>();
  private morphs = new Map<Expression, MorphRef[]>();
  private baseline = new Map<THREE.Mesh, number[]>();
  readonly summary: string;

  constructor(root: THREE.Group, parser?: unknown) {
    const list: THREE.Bone[] = [];
    const meshes: THREE.Mesh[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.Bone) list.push(object);
      if (object instanceof THREE.Mesh && object.morphTargetInfluences?.length) {
        meshes.push(object);
        this.baseline.set(object, [...object.morphTargetInfluences]);
      }
    });
    for (const key of ["head", "neck", "chest", "hips", "leftArm", "rightArm", "leftLeg", "rightLeg"]) {
      const bone = findBone(list, key);
      if (bone) {
        this.bones.set(key, bone);
        this.rest.set(bone, bone.quaternion.clone());
      }
    }
    const seen = new Set<string>();
    const register = (exp: Expression, mesh: THREE.Mesh, index: number, weight: number) => {
      if (!mesh.morphTargetInfluences || index < 0 || index >= mesh.morphTargetInfluences.length) return;
      const key = exp + "/" + mesh.uuid + "/" + index;
      if (seen.has(key)) return;
      seen.add(key);
      const refs = this.morphs.get(exp) ?? [];
      refs.push({ mesh, index, weight: Math.max(0, Math.min(1, weight)) });
      this.morphs.set(exp, refs);
    };

    // GLTFLoader supports ordinary morph target dictionaries.
    for (const mesh of meshes) {
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
        const exp = expressionOf(name);
        if (exp) register(exp, mesh, index, 1);
      }
    }

    // VRM 0.x commonly stores expressions in extension.VRM.blendShapeMaster
    // rather than meaningful mesh.morphTargetDictionary names.
    const gltfParser = parser as ParserLike | undefined;
    const groups = gltfParser?.json?.extensions?.VRM?.blendShapeMaster?.blendShapeGroups ?? [];
    const associations = gltfParser?.associations;
    for (const group of groups) {
      const exp = expressionOf(group.presetName ?? "") ?? expressionOf(group.name ?? "");
      if (!exp) continue;
      for (const bind of group.binds ?? []) {
        for (const mesh of meshes) {
          const meshIndex = associations?.get(mesh)?.meshes;
          if (meshIndex === bind.mesh) register(exp, mesh, bind.index, (bind.weight ?? 100) / 100);
        }
      }
    }

    const enabled = [...this.morphs.keys()];
    const faceInfo = enabled.length ? enabled.join(", ") : "không tìm thấy preset morph tương thích";
    this.summary = "Rig: " + this.bones.size + "/8 bones QA · Face: " + faceInfo + ".";
  }

  getMode() { return this.motion; }

  setMode(mode: QaMotion) {
    if (this.motion === mode) return;
    this.restore();
    this.motion = mode;
    this.elapsed = 0;
  }

  private restore() {
    for (const [bone, rest] of this.rest) bone.quaternion.copy(rest);
    for (const [mesh, weights] of this.baseline) {
      if (!mesh.morphTargetInfluences) continue;
      for (let i = 0; i < weights.length; i++) mesh.morphTargetInfluences[i] = weights[i];
    }
  }

  private rotate(key: string, x = 0, y = 0, z = 0) {
    const bone = this.bones.get(key);
    const base = bone && this.rest.get(bone);
    if (!bone || !base) return;
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
    bone.quaternion.copy(base).multiply(rotation);
  }

  private expression(exp: Expression, intensity: number) {
    for (const { mesh, index, weight } of this.morphs.get(exp) ?? []) {
      if (!mesh.morphTargetInfluences) continue;
      mesh.morphTargetInfluences[index] = THREE.MathUtils.clamp(intensity * weight, 0, 1);
    }
  }

  private animate(mode: QaMotion, t: number) {
    const tau = 2 * Math.PI;
    const pulse = (time: number, center: number, width: number) =>
      Math.exp(-Math.pow((time - center) / width, 2));
    const wave = (speed: number) => Math.sin(t * speed * tau);
    switch (mode) {
      case "blink": {
        const phase = t % 2.3;
        this.expression("blink", Math.min(1, pulse(phase, 0.2, 0.095) + pulse(phase, 0.40, 0.085)));
        return;
      }
      case "smile": this.expression("smile", 0.56 + 0.42 * Math.sin(t * 1.4)); return;
      case "angry": this.expression("angry", 0.55 + 0.40 * Math.sin(t * 1.3)); return;
      case "eye-look": {
        const phase = t % 5;
        const exp: Expression = phase < 1.25 ? "lookLeft" : phase < 2.5 ? "lookRight" :
          phase < 3.75 ? "lookUp" : "lookDown";
        this.expression(exp, 0.8);
        return;
      }
      case "mouth": this.expression("mouth", 0.5 + 0.48 * Math.sin(t * 3.2)); return;
      case "head-nod": this.rotate("head", 0.20 * wave(0.43)); return;
      case "head-shake": this.rotate("head", 0, 0.25 * wave(0.36)); return;
      case "head-tilt": this.rotate("head", 0, 0, 0.18 * wave(0.36)); return;
      case "idle":
        this.rotate("chest", 0.025 * wave(0.24), 0.030 * wave(0.20), 0.043 * wave(0.27));
        this.rotate("head", -0.018 * wave(0.24), -0.02 * wave(0.20), -0.02 * wave(0.27));
        return;
      case "step": {
        const phase = wave(0.9);
        this.rotate("leftLeg", 0.18 * phase);
        this.rotate("rightLeg", -0.18 * phase);
        this.rotate("leftArm", -0.17 * phase);
        this.rotate("rightArm", 0.17 * phase);
        this.rotate("chest", 0.02 * phase, 0.04 * phase, 0.04 * wave(1.8));
        return;
      }
      case "wave":
        this.rotate("rightArm", -0.25, 0.08, -0.32 - 0.22 * wave(0.72));
        this.rotate("head", 0, 0.06 * wave(0.55), 0.04);
        return;
    }
  }

  update(delta: number) {
    if (this.motion === "off") return;
    this.elapsed += Math.max(0, Math.min(delta, 0.05));
    this.restore();
    if (this.motion !== "suite") {
      this.animate(this.motion, this.elapsed);
      return;
    }
    const modes: QaMotion[] = ["blink", "smile", "angry", "head-nod", "head-shake", "head-tilt", "idle", "step", "wave"];
    const index = Math.floor(this.elapsed / 3.5) % modes.length;
    this.animate(modes[index], this.elapsed % 3.5);
  }

  dispose() {
    this.restore();
    this.motion = "off";
    this.morphs.clear();
    this.baseline.clear();
    this.rest.clear();
    this.bones.clear();
  }
}
