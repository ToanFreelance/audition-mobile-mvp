import * as THREE from "three";
import { CharacterActor } from "../character/CharacterActor";
import type { CharacterAssetId } from "../character/character-catalog";
import { getEnsembleFormation, type EnsembleParticipant, type FormationPlacement } from "./formation";

export type EnsembleActorStatus = "loading" | "loaded" | "error";
export type EnsembleActorDiagnostic = FormationPlacement & Readonly<{
  state: EnsembleActorStatus;
  error?: string;
  local: boolean;
}>;
export type EnsembleDiagnostic = Readonly<{
  expected: number;
  loaded: number;
  failed: number;
  actors: readonly EnsembleActorDiagnostic[];
}>;

type Entry = {
  assetId: CharacterAssetId;
  actor: CharacterActor;
  placement: FormationPlacement;
  state: EnsembleActorStatus;
  error?: string;
};

type Options = {
  onChange: (value: EnsembleDiagnostic) => void;
  onActorCreate?: () => void;
  onActorDispose?: () => void;
  afterLoad?: (root: THREE.Object3D) => void;
};

/**
 * Stage-owned actor lifecycle. Only actor identity/asset changes replace a
 * CharacterActor; metadata, scores and Ready changes never touch this map.
 * All mixers are owned by their own CharacterActor. No renderer/RAF is created.
 */
export class EnsembleActorGroup {
  private readonly entries = new Map<string, Entry>();
  private readonly localMarker: THREE.Mesh;
  private localParticipantId = "";
  private active = false;
  private disposed = false;
  private order: readonly string[] = [];

  constructor(
    private readonly stage: THREE.Group,
    private readonly stageId: string,
    private readonly options: Options,
  ) {
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.72, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffe09c, transparent: true, opacity: 0.93,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    marker.name = "EnsembleLocalPlayerFocus";
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    marker.renderOrder = 3;
    this.stage.add(marker);
    this.localMarker = marker;
  }

  get count() { return this.entries.size; }

  getLocalActor(): CharacterActor | null {
    return this.entries.get(this.localParticipantId)?.actor ?? null;
  }

  getDiagnostic(): EnsembleDiagnostic {
    const actors = this.order.map(id => {
      const item = this.entries.get(id)!;
      return {
        ...item.placement, state: item.state, error: item.error,
        local: id === this.localParticipantId,
      };
    });
    return {
      expected: actors.length,
      loaded: actors.filter(item => item.state === "loaded").length,
      failed: actors.filter(item => item.state === "error").length,
      actors,
    };
  }

  reconcile(participants: readonly EnsembleParticipant[], localId: string, active: boolean) {
    if (this.disposed) return;
    const plan = getEnsembleFormation(this.stageId, participants);
    const incoming = new Map(plan.map(item => [item.participantId, item]));
    for (const [id, entry] of this.entries) {
      const match = incoming.get(id);
      if (!match || match.characterAssetId !== entry.assetId) {
        entry.actor.dispose();
        this.options.onActorDispose?.();
        this.entries.delete(id);
      }
    }
    this.localParticipantId = localId;
    this.order = plan.map(p => p.participantId);
    for (const placement of plan) {
      let entry = this.entries.get(placement.participantId);
      if (!entry) {
        const actor = CharacterActor.fromAssetId(placement.characterAssetId);
        actor.root.name = `EnsembleActor:${placement.participantId}`;
        entry = { actor, assetId: placement.characterAssetId, placement, state: "loading" };
        this.entries.set(placement.participantId, entry);
        this.stage.add(actor.root);
        this.options.onActorCreate?.();
        const pending = entry;
        void actor.load().then(result => {
          if (this.disposed || this.entries.get(placement.participantId) !== pending) return;
          if (!result || result.source !== "gltf" || result.error
            || result.metrics.skinnedMeshes < 1 || result.metrics.animationClips.length === 0) {
            pending.state = "error";
            pending.error = result?.error ?? "GLB skinned actor or animation clips unavailable";
          } else {
            this.options.afterLoad?.(actor.root);
            pending.state = "loaded";
          }
          this.emit();
        }).catch(error => {
          if (this.disposed || this.entries.get(placement.participantId) !== pending) return;
          pending.state = "error";
          pending.error = error instanceof Error ? error.message : String(error);
          this.emit();
        });
      }
      entry.placement = placement;
      entry.actor.root.position.set(placement.x, placement.y, placement.z);
    }
    this.setGameActive(active);
    const local = this.entries.get(this.localParticipantId)?.placement;
    this.localMarker.visible = Boolean(local);
    if (local) this.localMarker.position.set(local.x, 0.075, local.z);
    this.emit();
  }

  setGameActive(active: boolean) {
    if (this.disposed || this.active === active) return;
    this.active = active;
    for (const { actor } of this.entries.values()) actor.setGameActive(active);
  }

  update(delta: number, renderTime: number, songMs: number) {
    if (this.disposed) return;
    for (const { actor } of this.entries.values()) actor.update(delta, renderTime, songMs);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { actor } of this.entries.values()) {
      actor.dispose();
      this.options.onActorDispose?.();
    }
    this.entries.clear();
    this.localMarker.removeFromParent();
    this.localMarker.geometry.dispose();
    (this.localMarker.material as THREE.Material).dispose();
  }

  private emit() { this.options.onChange(this.getDiagnostic()); }
}
