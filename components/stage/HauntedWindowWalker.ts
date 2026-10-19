import * as THREE from "three";

/**
 * Haunted Classroom window passer-by.
 *
 * One original, adult-proportioned 3D human assembled with low-poly garments,
 * hair, sleeves and jointed legs. This is deliberately a *shadow of a person*
 * behind dirty glass, not a glowing cartoon ghost pasted to a 2D plane.
 *
 * No skeleton, GLB request, second animation mixer, game-clock dependency,
 * collider or gameplay state. Geometry lives under the Stage3D environment
 * and is disposed by HauntedClassroomV1Environment.dispose().
 */
export type WindowWalker = {
  readonly root: THREE.Group;
  readonly materials: readonly THREE.MeshBasicMaterial[];
  readonly legs: readonly [THREE.Group, THREE.Group];
  readonly arms: readonly [THREE.Group, THREE.Group];
  readonly hair: THREE.Group;
};

export function createWindowWalker(): WindowWalker {
  const root = new THREE.Group();
  root.name = "AdultLongHairedWomanWalkingBehindWindow";

  const coat = new THREE.MeshBasicMaterial({
    color: 0x17141b, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const coatFold = new THREE.MeshBasicMaterial({
    color: 0x28232a, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const hairMaterial = new THREE.MeshBasicMaterial({
    color: 0x0d0b13, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const exposedSkin = new THREE.MeshBasicMaterial({
    color: 0x332a34, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const shoe = new THREE.MeshBasicMaterial({
    color: 0x100e16, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const materials = [coat, coatFold, hairMaterial, exposedSkin, shoe];

  const attach = (
    name: string, geometry: THREE.BufferGeometry, material: THREE.MeshBasicMaterial,
    position: [number, number, number], scale: [number, number, number],
    parent: THREE.Group = root,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    // Objects move behind glass. They are small and never cast shadows.
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    parent.add(mesh);
    return mesh;
  };
  const sphere = (name: string, x: number, y: number, z: number,
    rx: number, ry: number, rz: number, m: THREE.MeshBasicMaterial,
    p: THREE.Group = root) =>
    attach(name, new THREE.SphereGeometry(1, 12, 9), m, [x,y,z], [rx,ry,rz], p);
  const tube = (name: string, x: number, y: number, z: number,
    topRadius: number, bottomRadius: number, length: number,
    sx: number, sz: number, m: THREE.MeshBasicMaterial, p: THREE.Group=root) =>
    attach(name, new THREE.CylinderGeometry(topRadius,bottomRadius,length,12),
      m,[x,y,z],[sx,1,sz],p);

  // Human proportions, about 7.3 heads tall: longer legs, a clear waist,
  // gently sloping shoulders, neck, adult head and separate clothing layers.
  tube("BlackCoatTorso",0,2.15,0,.315,.265,1.08,1,.74,coat);
  sphere("CoatShoulderLeft",-.27,2.58,0,.12,.15,.17,coat);
  sphere("CoatShoulderRight",.27,2.58,0,.12,.15,.17,coat);
  // Long dark coat over trousers, fabric taper and overlapping panels.
  tube("LongBlackCoatHem",0,1.48,0,.26,.47,.83,1,.76,coat);
  tube("OpenCoatInnerPanel",.06,1.49,.11,.19,.29,.73,.94,.42,coatFold);
  sphere("ClothedChest",.055,2.41,.08,.25,.28,.14,coat);
  tube("Neck",.055,2.77,0,.095,.092,.19,1,1,exposedSkin);
  sphere("AdultHeadProfile",.11,3.13,0,.22,.305,.205,exposedSkin);
  sphere("NaturalNose",.329,3.085,.012,.075,.07,.085,exposedSkin);
  sphere("ProfileChin",.222,2.925,.025,.11,.07,.112,exposedSkin);
  // Hair cap with strands falling below shoulders, not a cartoon outline.
  const hair = new THREE.Group();
  hair.name="LongStraightHangingHair";
  root.add(hair);
  sphere("BlackHairCrown",.055,3.255,-.025,.265,.274,.231,hairMaterial,hair);
  sphere("SidePartingFringe",.219,3.171,.035,.12,.205,.178,hairMaterial,hair);
  for (const [x,z,length,radius] of [
    [-.19,-.15,.95,.123],[-.21,.055,1.13,.125],
    [-.15,.21,.89,.095],[.015,-.205,.94,.085],
    [.08,.19,.73,.09],
  ] as const) {
    // Strands taper subtly and hang under gravity to mid-back.
    tube("HangingHairStrand",x,2.70-(length-.73)*.31,z,
      radius*.92,radius*.59,length,1,1,hairMaterial,hair);
  }
  sphere("LongHairBackVolume",-.17,2.59,-.045,.16,.63,.20,hairMaterial,hair);
  // Small costume details appear under low light as a coat, not a dark blob.
  tube("CoatCollarLeft",-.16,2.61,.137,.094,.035,.33,1,.68,coatFold);
  tube("CoatCollarRight",.15,2.61,.137,.094,.035,.33,1,.68,coatFold);
  tube("CoatSeam",.045,2.12,.193,.012,.012,.72,1,1,coatFold);

  // Jointed limbs are pivoted at shoulders and hips, so the gait is
  // recognizable without translating the entire body vertically.
  const makeArm=(side: number): THREE.Group=>{
    const group=new THREE.Group();
    group.name=side<0?"NearSwingingCoatSleeve":"FarSwingingCoatSleeve";
    group.position.set(side*.325,2.54,side*.035);
    root.add(group);
    tube("LongBlackSleeve",side*.055,-.36,0,.135,.092,.76,.92,.94,coat,group);
    sphere("CoatSleeveElbow",side*.055,-.73,0,.095,.105,.102,coat,group);
    tube("WristCuff",side*.045,-.83,0,.082,.078,.15,1,1,coatFold,group);
    sphere("DarkNaturalHand",side*.045,-.961,.007,.070,.115,.074,exposedSkin,group);
    return group;
  };
  const arms:[THREE.Group,THREE.Group]=[makeArm(-1),makeArm(1)];
  const makeLeg=(side:number):THREE.Group=>{
    const group=new THREE.Group();
    group.name=side<0?"NearWalkingLeg":"FarWalkingLeg";
    group.position.set(side*.155,1.48,side*.045);
    root.add(group);
    tube("DarkClothedThigh",0,-.385,0,.141,.116,.77,1,1,coatFold,group);
    sphere("HumanKnee",.023,-.795,0,.12,.13,.105,coatFold,group);
    tube("LongDarkTrouserLeg",.040,-1.045,.002,.120,.092,.53,1,.95,coat,group);
    // Shoes point toward the woman's facing direction (+X in profile).
    sphere("SolidShoeOnFloor",.138,-1.357,.023,.23,.085,.14,shoe,group);
    return group;
  };
  const legs:[THREE.Group,THREE.Group]=[makeLeg(-1),makeLeg(1)];

  // Flatten depth only a little behind the pane. Geometry and articulated
  // limbs stay real 3D objects; camera perceives a soft human silhouette.
  root.scale.z=.26;
  return {root,materials,legs,arms,hair};
}
