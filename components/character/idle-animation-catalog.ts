export type IdleCandidateAsset = {
  id: string;
  name: string;
  provider: "Adobe Mixamo";
  category: "idle";
  format: "FBX Binary";
  sourceFileName: string;
  bytes: number;
  sha256: string;
};

export const P51_IDLE_POOL_VERSION = 1 as const;
export const P51_IDLE_POOL_SOURCE_VERSION = "mixamo-p5.1c-idle-2026-09-17" as const;

export const P51_IDLE_CANDIDATES: readonly IdleCandidateAsset[] = [
  {
    id: "idle_mixamo_001",
    name: "Standing Greeting",
    provider: "Adobe Mixamo",
    category: "idle",
    format: "FBX Binary",
    sourceFileName: "Standing Greeting.fbx",
    bytes: 711008,
    sha256: "f302d23e5324ed89e26f1040acd38381f54da34ae8e22bb87d36fa93990e2874",
  },
  {
    id: "idle_mixamo_002",
    name: "Happy Idle",
    provider: "Adobe Mixamo",
    category: "idle",
    format: "FBX Binary",
    sourceFileName: "Happy Idle.fbx",
    bytes: 588720,
    sha256: "61e384d1d166a93d52bfe8a8209b4f1fff1bfba5bd2c60bcdfd22f1f178cec06",
  },
  {
    id: "idle_mixamo_003",
    name: "Breathing Idle",
    provider: "Adobe Mixamo",
    category: "idle",
    format: "FBX Binary",
    sourceFileName: "Breathing Idle.fbx",
    bytes: 1107456,
    sha256: "ec3524d1bb6075ccf87dbe99676f95b6403d65672ef0be96f0e5c5f17bb12dac",
  },
  {
    id: "idle_mixamo_004",
    name: "Standing Idle",
    provider: "Adobe Mixamo",
    category: "idle",
    format: "FBX Binary",
    sourceFileName: "Standing Idle.fbx",
    bytes: 728144,
    sha256: "adb5baba092bbbdd40ee480908d37f3ebfa0b17c251988afb2cd4305fb4cab5b",
  },
] as const;

export const P51_IDLE_SOURCE_PACKAGE = {
  fileName: "idle_mixamo_source_pack.zip",
  bytes: 3136002,
  sha256: "df7b68ce6718fc73213af4a94ea4e738641182760e9cf21ed954cf5b93267eca",
  visibility: "owner-local-private",
  sourceVersion: P51_IDLE_POOL_SOURCE_VERSION,
} as const;
