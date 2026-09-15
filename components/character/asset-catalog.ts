export type AssetSourceStatus = "source-pinned" | "source-persisted-private";

export type ReferenceCharacterAsset = {
  id: string;
  name: string;
  sex: "male" | "female";
  provider: "Quaternius";
  family: "Universal Base Characters";
  format: "GLB";
  license: "CC0-1.0";
  approxHeightM: number;
  sourceUrl: string;
  status: AssetSourceStatus;
};

export type DanceCandidateAsset = {
  id: string;
  name: string;
  provider: "Adobe Mixamo";
  category: "dance";
  format: "FBX Binary";
  sourceFileName: string;
  bytes: number;
  sha256: string;
  privateStorage: {
    provider: "Supabase Storage";
    bucket: "asset-sources";
    object: "P3_7_Mixamo_Source_Batch_2026-09-15.zip";
  };
  status: AssetSourceStatus;
};

export const P37_REFERENCE_CHARACTERS: readonly ReferenceCharacterAsset[] = [
  {
    id: "char_male_reference_01",
    name: "Quaternius UBC Superhero Male FullBody",
    sex: "male",
    provider: "Quaternius",
    family: "Universal Base Characters",
    format: "GLB",
    license: "CC0-1.0",
    approxHeightM: 1.82,
    sourceUrl:
      "https://raw.githubusercontent.com/Ashen-Skool/Aot-Fable-5.1/122378c422148390c781adc6d7019eda7b5d07f3/assets/staged/anim/UBC_Superhero_Male_FullBody.glb",
    status: "source-pinned",
  },
  {
    id: "char_female_reference_01",
    name: "Quaternius UBC Superhero Female FullBody",
    sex: "female",
    provider: "Quaternius",
    family: "Universal Base Characters",
    format: "GLB",
    license: "CC0-1.0",
    approxHeightM: 1.78,
    sourceUrl:
      "https://raw.githubusercontent.com/Ashen-Skool/Aot-Fable-5.1/122378c422148390c781adc6d7019eda7b5d07f3/assets/staged/anim/UBC_Superhero_Female_FullBody.glb",
    status: "source-pinned",
  },
];

const PRIVATE_SOURCE_PACKAGE = {
  provider: "Supabase Storage" as const,
  bucket: "asset-sources" as const,
  object: "P3_7_Mixamo_Source_Batch_2026-09-15.zip" as const,
};

export const P37_DANCE_CANDIDATES: readonly DanceCandidateAsset[] = [
  { id: "dance_mixamo_001", name: "Hip Hop Dancing", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_001.fbx", bytes: 1411312, sha256: "fc1603e56237a7010e0e3f73340444fb03609b429b3f915db67d330e4bd486c7", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_002", name: "Silly Dancing", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_002.fbx", bytes: 572912, sha256: "dc274060446b604072e5c34615a1e99794b7cb02c56670323392cff9a2c13644", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_003", name: "Salsa Dancing", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_003.fbx", bytes: 1841232, sha256: "cacad46bcbfbad09634fad30b84f189c3fec4a89b3c1c3537c8694bb2d3d1254", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_004", name: "Swing Dancing", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_004.fbx", bytes: 1721168, sha256: "e32b7e7f4535581aab39b0be6da4d19280bbc111ce5d85ee1f8d6e02372c7297", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_005", name: "Wave Hip Hop Dance", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_005.fbx", bytes: 2995360, sha256: "22fc8e02cacb12e60cec6581c00410ada3447c3146b06f9af3abee9b3903bbff", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_006", name: "Breakdance Freezes", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_006.fbx", bytes: 869584, sha256: "79d99d5ccf7729756e3c3a8a13d9d94bbf55e386840a2f67cf45e058b1f7af42", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_007", name: "Capoeira", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_007.fbx", bytes: 690880, sha256: "f65fb0fddd111b1ce7de710a5598d776371c1969d1599541f92e3268a723b85e", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_008", name: "Jazz Dancing", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_008.fbx", bytes: 572368, sha256: "d6a6ff5407d711fa593f76d409e8c619e3fb60cb050e1300f1d905c7a583a285", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_009", name: "Samba Dancing", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_009.fbx", bytes: 1721952, sha256: "f4c60b749eb3e1368cef4fdd560d3b417ea85f86ad00da1a70a544ea3a97e1a2", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_010", name: "YMCA Dance", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_010.fbx", bytes: 669712, sha256: "d295eba941f4e7189862b3f316d446eac5dd2e83fad8ae46492738a242adf813", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_011", name: "Macarena Dance", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_011.fbx", bytes: 957216, sha256: "620fda08dee0a247c600feef05dbcac29e50b0226e10bb0055b7cbad6434c5e7", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_012", name: "Rumba Dancing", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_012.fbx", bytes: 495008, sha256: "5e71dc98f9c08cd65f82e81cab911c3cd7ad726186c542e3b988fed07be790a0", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_013", name: "Northern Soul Spin", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_013.fbx", bytes: 724144, sha256: "259720115d2c28f89b2855c397dffae25088ba405acbea62b09babdd47bd3e92", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_014", name: "Twist Dance", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_014.fbx", bytes: 995920, sha256: "df101318dd8ea4bc7dfeee90043191d57339061ec90f7f7554983b7fd38a9d0c", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
  { id: "dance_mixamo_015", name: "Flair", provider: "Adobe Mixamo", category: "dance", format: "FBX Binary", sourceFileName: "dance_mixamo_015.fbx", bytes: 379136, sha256: "bb4ce4d3d4d47165f3e941ca70e3ef0abbbe8a2b16b6e7dccb847e9d34ee4068", privateStorage: PRIVATE_SOURCE_PACKAGE, status: "source-persisted-private" },
];

export const P37_PRIVATE_SOURCE_PACKAGE = {
  ...PRIVATE_SOURCE_PACKAGE,
  bytes: 6185438,
  sha256: "b2ea022a0f9941c46975c37a0f9d34d093accf5eeab009008a3987021216c1ef",
  visibility: "private" as const,
};
