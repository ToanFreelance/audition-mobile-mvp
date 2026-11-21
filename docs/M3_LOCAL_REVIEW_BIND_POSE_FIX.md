# M3 owner FBX arm corruption — bind/rest-pose retarget correction

Owner supplied iPhone screenshots of the imported `Cheering` at 1.6/2.9 s and `Arm Stretching` at 2.7/8.9 s: arms cross/bend unnaturally. Native Mixamo FBX positions show Cheering raising both hands above shoulder height at 1.6 s. Decoding the delivered M3_Cheering_Arm_Stretching_review.json confirms packed source delta quaternions match source FBX within ~0.003 degrees. **The source FBX files themselves are not corrupted**.

## Root cause

`createLocalReviewRetargeter` captured the target skeleton's **current displayed bone pose** as its source-delta reference. An actor's M3 pose at import time may be an authored idle rather than the original mesh/skin bind rest. Applying `sourceWorldDelta * currentlyPosedTargetWorldRotation` to arms led to different absolute motion/arm crossings even though source and target share a Mixamo-compatible T-pose orientation in actual bind.

## Focused change

Capture real `THREE.Skeleton.pose()` skin bind matrices for every bone before creating local target rest quaternions; restore all original bone position/quaternion/scale transforms immediately in finally. Calculate target root baseline and height in that same bind pose (not the currently-playing animation). All other source world delta samples, animation duration, root offsets, skin weights, existing mixer and QA import remain unchanged. Source FBX/JSON pack does not need to be replaced.

## Validation

New Playwright unit regression uses real M3 female/male rest fixtures to create a skinned skeleton, pre-poses both shoulders with deliberate large quaternion deviations and compares source identity-delta retarget tracks to those from an actual bind-pose actor. They must be identical and model bones must remain pre-posed after rest sampling. The same tests inject the actual Cheering 1.6 s world delta samples for shoulder/upper/lower/hand and require BOTH wrists to rise above their upper arms.

Focused browser QA still verifies importing both local clips into the isolated 9+2 female and 8+2 male review, Next/Back and actor/mixer identity. Owner iPhone visual re-review required before accepting arm quality or adding to Waiting Room random.

**Scope restrictions:** do not change original FBX/source pack, do not modify V7/V8 contact pipeline or runtime Foot Lock, do not touch RoomState/CAS/Realtime/Ready/Host Start, WebAudio/global timeline, and no merge.
