import * as T from "three";

export type HeroineLightingPreset = "original" | "studio";

type ShadowEntry = {
  mesh:T.Mesh;
  castShadow:boolean;
  receiveShadow:boolean;
};
type SurfaceEntry = {material:T.MeshStandardMaterial;roughness:number};

/**
 * Isolated Unified Heroine lighting comparison. This changes presentation
 * only: never rebuilds GLB, actor, eye module, skeleton or AnimationMixer.
 * Original reproduces the QA baseline; Studio is opt-in for owner iPhone QA.
 */
export class HeroineStudioDepth {
  private readonly scene:T.Scene;
  private readonly renderer:T.WebGLRenderer;
  private readonly baselineLights:T.Light[];
  private readonly studioRig:T.Group;
  private readonly originalExposure:number;
  private readonly originalShadowEnabled:boolean;
  private readonly originalShadowType:T.ShadowMapType;
  private actor:T.Group|null=null;
  private shadows:ShadowEntry[]=[];
  private surfaces:SurfaceEntry[]=[];
  private preset:HeroineLightingPreset="original";
  readonly mobileShadowSize:number;
  readonly primaryLight:T.DirectionalLight;

  constructor(scene:T.Scene,renderer:T.WebGLRenderer,mobile:boolean){
    this.scene=scene;
    this.renderer=renderer;
    this.baselineLights=scene.children.filter((n):n is T.Light=>n instanceof T.Light);
    this.originalExposure=renderer.toneMappingExposure;
    this.originalShadowEnabled=renderer.shadowMap.enabled;
    this.originalShadowType=renderer.shadowMap.type;
    this.studioRig=new T.Group();
    this.studioRig.name="UHV1_StudioDepth_QA_Lights";

    // One directional key creates readable cheek, nose and hair depth;
    // a low-intensity neutral fill retains anime facial proportions.
    const hemi=new T.HemisphereLight(0xfff3fc,0x695b7d,1.27);
    this.studioRig.add(hemi);

    const key=new T.DirectionalLight(0xffe7f1,2.75);
    key.name="UHV1_StudioDepth_KeyWithHairShadow";
    key.position.set(-3.5,5.2,4.4);
    key.target.position.set(0,1.95,0);
    key.castShadow=true;
    this.mobileShadowSize=mobile?512:1024;
    key.shadow.mapSize.set(this.mobileShadowSize,this.mobileShadowSize);
    key.shadow.camera.left=-1.55;
    key.shadow.camera.right=1.55;
    key.shadow.camera.top=1.55;
    key.shadow.camera.bottom=-1.55;
    key.shadow.camera.near=.5;
    key.shadow.camera.far=13;
    key.shadow.bias=-.00025;
    key.shadow.normalBias=.022;
    key.shadow.radius=2;
    this.studioRig.add(key,key.target);
    this.primaryLight=key;

    const fill=new T.DirectionalLight(0xe4e8ff,1.28);
    fill.position.set(3.3,2.7,2.6);
    this.studioRig.add(fill);

    const rim=new T.DirectionalLight(0xbe9bfa,1.42);
    rim.position.set(1.2,3.7,-3.1);
    this.studioRig.add(rim);

    this.studioRig.visible=false;
    scene.add(this.studioRig);
  }

  attachActor(root:T.Group){
    this.actor=root;
    const seen=new Set<T.MeshStandardMaterial>();
    root.traverse(object=>{
      if(!(object instanceof T.Mesh))return;
      const mats=Array.isArray(object.material)?object.material:[object.material];
      const hair=mats.some(m=>/Hair_/i.test(m.name));
      const skin=mats.some(m=>/(Face_00_SKIN|Body_00_SKIN|FaceMouth)/i.test(m.name));

      if(hair||skin){
        this.shadows.push({
          mesh:object,
          castShadow:object.castShadow,
          receiveShadow:object.receiveShadow,
        });
      }
      for(const m of mats){
        if(!(m instanceof T.MeshStandardMaterial)||seen.has(m))continue;
        if(!hair&&!skin)continue;
        seen.add(m);
        this.surfaces.push({material:m,roughness:m.roughness});
      }
    });
    this.setPreset(this.preset);
  }

  setPreset(preset:HeroineLightingPreset){
    this.preset=preset;
    const studio=preset==="studio";
    this.baselineLights.forEach(light=>{light.visible=!studio});
    this.studioRig.visible=studio;
    this.renderer.toneMappingExposure=studio?1.16:this.originalExposure;
    this.renderer.shadowMap.type=studio?T.PCFSoftShadowMap:this.originalShadowType;
    this.renderer.shadowMap.enabled=studio?true:this.originalShadowEnabled;

    for(const {mesh,castShadow,receiveShadow} of this.shadows){
      const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const hair=mats.some(m=>/Hair_/i.test(m.name));
      const skin=mats.some(m=>/(Face_00_SKIN|Body_00_SKIN|FaceMouth)/i.test(m.name));
      mesh.castShadow=studio&&hair?true:castShadow;
      mesh.receiveShadow=studio&&skin?true:receiveShadow;
    }
    for(const {material,roughness} of this.surfaces){
      if(studio){
        material.roughness=/Hair_/i.test(material.name)?Math.min(roughness,.66):Math.min(roughness,.78);
      }else{
        material.roughness=roughness;
      }
      material.needsUpdate=true;
    }
  }

  diagnostics(){
    return {
      preset:this.preset,
      changedSurfaceMaterials:this.surfaces.length,
      hairAndSkinMeshes:this.shadows.length,
      shadowResolution:this.mobileShadowSize,
      exposure:this.renderer.toneMappingExposure,
      actorUUID:this.actor?.uuid??null,
    };
  }

  dispose(){
    this.setPreset("original");
    this.renderer.shadowMap.enabled=this.originalShadowEnabled;
    this.renderer.shadowMap.type=this.originalShadowType;
    this.studioRig.removeFromParent();
    this.studioRig.traverse(obj=>{
      if(obj instanceof T.Light&&"shadow" in obj){
        const light=obj as T.DirectionalLight;
        light.shadow?.dispose();
      }
    });
    this.shadows=[];
    this.surfaces=[];
    this.actor=null;
  }
}

