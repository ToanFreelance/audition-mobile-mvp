"""Explicit human-readable source curation; never grade by a numeric threshold.

Recovered editorial decisions from the V2 review checkpoint. Reproducible source
hashes/contact sheets accompany the published package; owner acceptance pending.
"""
import argparse
import json
from pathlib import Path
from curate_v2 import write_json

STYLES = ['pop_casual', 'social_swing', 'modern_stage', 'world_folk', 'street_break', 'party_reaction']
RETAINED_STATUSES = {'A', 'B', 'SPECIAL', 'UTILITY', 'PARTNER'}
# sourceId | status | energy | floorWork | retargetRisk | editorial note
RETAINED = {
'modern_stage': '''
05_02|A|MEDIUM|STANDING|MED_HIGH|Expressive arm shapes and turns; shoulder calibration required.
05_03|B|MEDIUM|STANDING|MED|Side arabesque and folding arms; adjacent style to 05_04 but different phrase.
05_04|A|MEDIUM|LOW|MED|Clear sideways arabesque and back bend; representative spine/shoulder test.
05_07|A|HIGH|STANDING|HIGH|Readable jetes and shifted-axis turn; preserve balance and airborne leg amplitude.
05_09|B|MEDIUM|STANDING|MED_HIGH|Glissade stepping with arabesque; travel and foot placement need review.
05_11|B|MEDIUM|STANDING|MED_HIGH|Side steps and pirouette; useful rotational stage phrase.
05_12|B|LOW|STANDING|LOW_MED|Arms-high torso rotation; subtle but useful low-energy stage backup.
05_13|B|HIGH|STANDING|HIGH|Small jetes into pirouette; leg lift and turn fidelity matter.
05_14|B|MEDIUM|STANDING|MED_HIGH|Retire/arabesque balance with readable lifted leg.
49_09|B|LOW|STANDING|MED|Slow arms-high arabesque; hold-heavy, not a strong general groove.
49_13|B|LOW|LOW|MED|Fold-in/curl silhouette; representative of repeated inward-fold takes.
49_17|B|LOW|LOW|MED_HIGH|Forward lean and arching arms; representative chosen over 49_12/14.
49_22|B|LOW|LOW|MED_HIGH|Bent-leg lean and elbow-by-ear balance; distinct low silhouette.
''',
'world_folk': '''
90_30|A|HIGH|LOW|HIGH|Russian-dance-labelled kicks/squats; visible foot angular warning, not target ready.
94_01|B|MEDIUM|LOW|MED|Distinct broad shapes; Unknown title, Indian context inferred only from subject.
94_03|A|MEDIUM|LOW|MED|Long expressive arm/step phrase; fingers uncaptured, no gesture-authenticity claim.
94_04|B|MEDIUM|STANDING|MED|Useful arm-led backup; needs later phrase trimming.
94_05|B|MEDIUM|LOW|MED|Long source take; retain varied sections, not a single production clip.
94_06|B|LOW|STANDING|LOW_MED|Readable softer arm/step phrase, lower intensity backup.
94_07|A|MEDIUM|LOW|MED|Strong broad arm silhouettes and grounded steps.
94_08|B|MEDIUM|LOW|MED|Alternative low/arm shapes; full-take review pending.
94_09|A|HIGH|LOW|MED_HIGH|Varied expressive stage phrase, useful energy contrast.
94_13|A|MEDIUM|STANDING|LOW_MED|Clear upright arm phrase; representative World retarget POC.
94_14|A|MEDIUM|LOW|MED|Readable contrasting arm and step phrase.
94_16|A|MEDIUM|STANDING|LOW_MED|Upright lighter phrase; do not infer captured finger articulation.
''',
'pop_casual': '''
55_01|A|MEDIUM|STANDING|MED|Whirl/loose dance gestures; readable casual performance.
111_05|A|MEDIUM|STANDING|LOW_MED|Compact accessible dance steps; representative low-risk Pop POC.
113_04|B|MEDIUM|STANDING|LOW_MED|Casual step variant of 111_05; not counted as independent choreography.
120_05|B|MEDIUM|STANDING|LOW_MED|Mickey-labelled dance variant; same choreography family as 120_06/07.
120_06|A|MEDIUM|STANDING|MED|Preferred Mickey-labelled dance take with larger expressive shapes.
120_07|B|MEDIUM|STANDING|LOW_MED|Shorter Mickey-labelled backup; same choreography family.
141_12|A|MEDIUM|STANDING|LOW_MED|Compact twist, clear on mobile; needs later loop-boundary review.
90_32|A|MEDIUM|STANDING|MED_HIGH|Moonwalk with intentional backward travel; do not foot-lock away its glide.
''',
'social_swing': '''
55_02|B|MEDIUM|STANDING|MED|Solo lambada-labelled phrase; not proof of paired Latin dance authenticity.
60_01|PARTNER|MEDIUM|STANDING|HIGH|Salsa role A; pair with 61_01. Toe angular discontinuity needs inspection.
61_01|PARTNER|MEDIUM|STANDING|HIGH|Salsa role B for 60_01; paired spacing/contact not yet validated.
60_03|PARTNER|MEDIUM|STANDING|MED_HIGH|Selected Salsa role A; future paired POC with 61_03.
61_03|PARTNER|MEDIUM|STANDING|MED_HIGH|Selected Salsa counterpart; validate synchronization together later.
60_05|PARTNER|MEDIUM|STANDING|MED|Salsa role A; pair with 61_05, not solo Normal.
61_05|PARTNER|MEDIUM|STANDING|HIGH|Salsa role B; hand orientation discontinuity warning, fingers uncaptured.
60_12|PARTNER|MEDIUM|STANDING|MED_HIGH|Salsa variant role A; coupled turns/hand placement.
61_12|PARTNER|MEDIUM|STANDING|MED_HIGH|Counterpart to 60_12; pair is one choreography family.
93_03|A|MEDIUM|STANDING|LOW_MED|Readable solo Charleston; representative retro/social POC.
93_04|PARTNER|MEDIUM|STANDING|MED|Side-by-side female-labelled role; preserve paired classification.
93_05|PARTNER|MEDIUM|STANDING|MED|Side-by-side male-labelled role; same family as 93_04.
93_06|PARTNER|HIGH|STANDING|HIGH|Lindy Hop; required counterpart not confirmed in this selection, not duet-ready.
93_08|A|HIGH|STANDING|MED|Fancy Charleston with distinct rhythmic leg accents.
''',
'party_reaction': '''
55_12|UTILITY|MEDIUM|LOW|MED|Human dancing bear novelty; utility, not general Pop filler.
55_25|UTILITY|HIGH|LOW|MED_HIGH|Dancing animal, broad expressive changes; event/reaction pool.
143_34|UTILITY|LOW|STANDING|LOW_MED|Readable chicken dance novelty, compact party use.
143_35|A|MEDIUM|STANDING|LOW|Macarena-labelled gesture sequence; clear mobile silhouette.
111_02|UTILITY|LOW|LOW|LOW_MED|Bow; stage acknowledgement/reaction, not solo dance Normal.
111_04|UTILITY|LOW|LOW|LOW_MED|Curtsey with bent knees; retain courtesy role.
111_16|UTILITY|LOW|STANDING|LOW_MED|Peekaboo; hand-to-face demands and no captured fingers.
111_37|UTILITY|LOW|STANDING|LOW_MED|Wave; useful waiting-room/reaction only, no integration.
120_03|UTILITY|MEDIUM|STANDING|MED|Mickey-labelled spell gesture; expressive event source, not gameplay asset.
''',
'street_break': '''
85_03|A|HIGH|LOW|MED_HIGH|Long upright break sequence; strong battle candidate without forcing floor role.
85_11|B|HIGH|LOW|MED_HIGH|Alternative upright break take; same family as 85_03.
85_04|SPECIAL|HIGH|FLOOR_SPIN|VERY_HIGH|Fancy footwork; near-180-degree thigh step, twist risk despite modest FK displacement.
85_05|SPECIAL|CLIMAX|INVERTED|HIGH|Handstand kicks; clear inverted Finish candidate, support-aware solve mandatory.
85_08|SPECIAL|CLIMAX|FLOOR_SPIN|VERY_HIGH|Helicopter floor rotation; hand/pelvis support and occluded contacts are high risk.
85_10|SPECIAL|HIGH|HAND_SUPPORTED|HIGH|End of breakdance; useful recovery/ending source, not an accepted Finish.
85_14|SPECIAL|CLIMAX|INVERTED|VERY_HIGH|Break with flips; thigh angular discontinuity and floor support risk.
90_28|SPECIAL|HIGH|FLOOR_SPIN|HIGH|Breakdance floor sequence; source only, preserve rotating body orientation.
85_01|SPECIAL|CLIMAX|STANDING|HIGH|Jump twist; dramatic upright airborne special, reject repeat 85_02.
85_06|SPECIAL|CLIMAX|INVERTED|HIGH|Kick flip; clean dramatic concept, full landing/contacts require target QA.
88_06|SPECIAL|HIGH|STANDING|HIGH|Jump/spin kick; battle accent, not casual dance.
88_07|SPECIAL|HIGH|HAND_SUPPORTED|HIGH|Cartwheel; selected acrobatic representative, intentional lateral travel.
88_08|SPECIAL|CLIMAX|INVERTED|HIGH|Crouch and backward hand flip; representative entry/support/recovery POC.
88_10|B|MEDIUM|STANDING|MED_HIGH|Stretch/spin phrase; stage/battle backup, trim stretch lead-in later.
89_03|SPECIAL|CLIMAX|INVERTED|VERY_HIGH|Flip and one-hand stand; near-175-degree thigh step, no automatic smoothing.
90_14|SPECIAL|CLIMAX|INVERTED|HIGH|Front hand flip; hand support and landing must be calibrated.
90_33|SPECIAL|HIGH|HAND_SUPPORTED|HIGH|Arm-up wide-leg roll; distinctive low silhouette, shoulder/hip range challenge.
'''}

# Explicit non-retained decisions. EXPLORE is not included in library count.
EXCLUDED = '''
05_05|EXPLORE|Extreme raised-leg and turning leap need full-speed leg/contact review.
05_06|EXPLORE|Cartwheel-like entry is promising but high shoulder/floor risk.
05_08|EXPLORE|Large leg circle/leap needs mobile-scale readability review.
05_10|REJECT|TOO_SIMILAR|Prefer 05_09 glissade phrase.
05_15|REJECT|TOO_SIMILAR|Prefer 05_14 balance phrase.
05_16|EXPLORE|Turning leap; later compare against 05_13/17 at full speed.
05_17|EXPLORE|Grand jete turn; need travel/landing review.
05_18|EXPLORE|Back-bend turn combination; later phrase-boundary review.
05_19|REJECT|TOO_SIMILAR|Prefer 05_18 for further investigation.
05_20|REJECT|TOO_SIMILAR|Repeated bend/arabesque family, no count inflation.
18_15|EXPLORE|Paired chicken dance; coupling and counterpart review required.
19_15|EXPLORE|Counterpart of 18_15; no general solo Normal classification.
20_01|REJECT|TOO_SIMILAR|Repeated paired chicken dance; keep 18/19 for exploration.
21_01|REJECT|TOO_SIMILAR|Paired repeat; not another independent dance.
49_10|REJECT|TOO_SIMILAR|Inward fold; prefer 49_13.
49_11|REJECT|TOO_SIMILAR|Repeated inward fold; prefer 49_13.
49_12|REJECT|TOO_SIMILAR|Probable near-duplicate of 49_17 forward lean/arching arms.
49_14|REJECT|TOO_SIMILAR|Probable near-duplicate of 49_17.
49_16|REJECT|TOO_SIMILAR|Repeated inward fold; prefer 49_13.
55_27|REJECT|POOR_MOBILE_READABILITY|Ant-like novelty less readable than selected bear/animal.
60_02|EXPLORE|Paired Salsa alternative; review counterpart before retention.
61_02|EXPLORE|Paired Salsa counterpart, not solo.
60_04|REJECT|TOO_SIMILAR|Selected Salsa phrases already cover the main variation.
61_04|REJECT|TOO_SIMILAR|Counterpart of unselected Salsa repeat.
60_06|REJECT|TOO_SIMILAR|No convincing extra mobile choreography versus selected pair set.
61_06|REJECT|TOO_SIMILAR|Counterpart repeat.
60_07|EXPLORE|Paired turn variation needs full-speed paired review.
61_07|EXPLORE|Counterpart spacing not verified.
60_08|REJECT|TOO_SIMILAR|Repeated Salsa family.
61_08|REJECT|TOO_SIMILAR|Counterpart repeat.
60_09|EXPLORE|Potential alternate turn; do not count until paired review.
61_09|EXPLORE|Counterpart to 60_09.
60_10|REJECT|TOO_SIMILAR|Selected Salsa set is sufficient for this pass.
61_10|REJECT|TOO_SIMILAR|Counterpart repeat.
60_11|REJECT|TOO_SIMILAR|Repeated Salsa family.
61_11|REJECT|TOO_SIMILAR|Counterpart repeat.
60_13|EXPLORE|Additional coupled phrase; further visual review needed.
61_13|EXPLORE|Counterpart to 60_13.
60_14|REJECT|TOO_SIMILAR|Repeated Salsa family.
61_14|REJECT|TOO_SIMILAR|Counterpart repeat.
60_15|REJECT|TOO_SIMILAR|Repeated Salsa family.
61_15|REJECT|TOO_SIMILAR|Counterpart repeat.
85_12|EXPLORE|Long mixed floor/break take; strong sections require phrase-level curation.
90_31|REJECT|TOO_SIMILAR|Probable near-duplicate Russian-dance variant; prefer 90_30.
94_02|EXPLORE|Indian-context Unknown take; further comparison with retained arm phrases.
94_10|EXPLORE|Potential World variation; full-speed readability not settled.
94_11|EXPLORE|World phrase backup under exploration only.
94_12|EXPLORE|World phrase backup under exploration only.
94_15|EXPLORE|Needs full-speed comparison; do not pad retained count.
103_03|REJECT|DUPLICATE|Byte-identical to 93_03.
103_04|REJECT|DUPLICATE|Byte-identical to 93_04.
103_05|REJECT|DUPLICATE|Byte-identical to 93_05.
103_06|REJECT|DUPLICATE|Byte-identical to 93_06.
103_08|REJECT|DUPLICATE|Byte-identical to 93_08.
85_02|REJECT|TOO_SIMILAR|Probable near-duplicate jump twist; prefer 85_01.
85_07|REJECT|LOW_CHOREOGRAPHIC_VALUE|Stumbling kick flip not preferred to 85_06.
85_15|REJECT|LOW_CHOREOGRAPHIC_VALUE|Twist/fall recovery less reusable than selected acrobatics.
87_01|EXPLORE|Jump kick/spin alternative; compare native-speed landing.
87_03|EXPLORE|Backflip candidate, compare with chosen hand-supported variants.
87_04|REJECT|TOO_SIMILAR|Repeated backflip family; no extra count.
87_05|REJECT|EXCESSIVE_TRAVEL|Cartwheel traversal; prefer 88_07 representative.
88_01|REJECT|TOO_SIMILAR|Backflip family already covered.
88_02|REJECT|PROP_DEPENDENCY|Includes platform jump/support; not general stage-floor material.
88_05|REJECT|EXCESSIVE_TRAVEL|Root envelope 3.43 reference-body heights in 1.23 seconds, with 161-degree thigh step; excessive for this pool.
89_04|EXPLORE|Mixed flips and handstand; needs support/phrase review.
89_05|EXPLORE|Long inverted sequence; high-risk exploration only.
90_02|REJECT|EXCESSIVE_TRAVEL|Traversing cartwheel; prefer selected shorter cartwheel.
90_08|EXPLORE|Side flip; later landing and root path review.
90_09|EXPLORE|Forward/back hand-supported flip; high-risk alternative.
90_11|EXPLORE|Handspring alternative; compare with 90_14.
90_19|EXPLORE|Monkey backflip; novelty/acrobatics not ordinary dance.
90_29|EXPLORE|Unclear sequence label; do not infer choreography from title.
120_04|EXPLORE|Conducting gesture could be utility; needs loop/gesture review.
120_15|REJECT|SEVERE_ANGULAR_ARTIFACT|Native sample 5 to 6: abrupt arm drop; retained only as failure evidence.
120_21|REJECT|NOT_DANCE|Robot-labelled locomotion does not justify Pop pool padding.
141_16|REJECT|TOO_SIMILAR|Wave utility already represented by 111_37.
141_22|EXPLORE|High five requires partner context/contact; not solo Normal.
142_20|EXPLORE|Singing-in-rain jump, utility/stage possibility; further landing review.
142_21|REJECT|EXCESSIVE_TRAVEL|Repeated travelling jump; retain 142_20 for exploration.
143_31|REJECT|NOT_DANCE|Hopscotch locomotor activity, not useful dance phrase here.
'''

NEAR = {'49_12':'49_17', '49_14':'49_17', '90_31':'90_30', '85_02':'85_01'}
FINISH = set('85_05 85_08 85_10 85_14 85_01 85_06 88_08 89_03 90_14'.split())
GROUPS = [
    ['120_05','120_06','120_07'], ['111_05','113_04'], ['85_03','85_11'],
    ['60_01','61_01'], ['60_03','61_03'], ['60_05','61_05'], ['60_12','61_12'], ['93_04','93_05']]
POCS = [
    ('Pop/Casual', ['111_05'], 'Compact upright steps: baseline shoulders and foot contact.'),
    ('Pop/Casual', ['90_32'], 'Moonwalk: intentional glide/travel must survive retargeting.'),
    ('Social', ['93_03'], 'Solo Charleston: foot rhythm and mobile silhouette.'),
    ('Social', ['60_03','61_03'], 'Paired Salsa: two roles; coupled hand spacing, not solo Normal.'),
    ('Modern', ['05_04'], 'Arabesque/back bend: balance, shoulders and spine range.'),
    ('Modern', ['05_07'], 'Jeté/turn: airborne leg lift and rotational continuity.'),
    ('World', ['94_13'], 'Upright expressive arm phrase; no captured finger claims.'),
    ('World', ['90_30'], 'Russian-labelled squats/kicks: low poses and known toe discontinuity.'),
    ('Street/Boss', ['85_03'], 'Upright break phrasing with greater range than casual steps.'),
    ('Street/Boss', ['90_33'], 'Wide-leg roll: support-aware shoulder/pelvis challenge.'),
    ('Finish/Special', ['85_05'], 'Handstand kicks: inversion and sustained hand support.'),
    ('Finish/Special', ['88_08'], 'Crouch/backward hand flip: entry, landing and recovery.')]


def style_for(i):
    s = int(i.split('_')[0])
    if s in (5,49): return 'modern_stage'
    if s in (60,61,93,103): return 'social_swing'
    if s == 94 or i=='90_31': return 'world_folk'
    if 85 <= s <= 90: return 'street_break'
    return 'party_reaction'


def partner_required(i):
    return int(i.split('_')[0]) in (18,19,20,21,60,61) or i in (
        '93_04','93_05','93_06','103_04','103_05','103_06','141_22')


def decisions(inventory):
    explicit = {}
    for style, text in RETAINED.items():
        for line in text.strip().splitlines():
            i, status, energy, floor, risk, note = line.split('|')
            assert i not in explicit
            explicit[i] = dict(stylePrimary=style, status=status, energy=energy,
                               floorWork=floor, retargetRisk=risk, notes=note, rejectionReason=None)
    for line in EXCLUDED.strip().splitlines():
        parts = line.split('|')
        i, status = parts[:2]
        assert i not in explicit
        explicit[i] = dict(stylePrimary=style_for(i), status=status, energy='UNASSESSED',
            floorWork='UNASSESSED', retargetRisk='UNASSESSED',
            notes=parts[-1], rejectionReason=parts[2] if status=='REJECT' else None)
    assert set(explicit) == {m['sourceId'] for m in inventory}, 'Every source needs an explicit decision'
    result = []
    for m in inventory:
        i = m['sourceId']
        d = explicit[i]
        retained = d['status'] in RETAINED_STATUSES
        group = next((g[0] for g in GROUPS if i in g), i)
        dupe = m.get('exactDuplicateOf') or ('cmu-'+NEAR[i] if i in NEAR else None)
        relation = 'EXACT_DUPLICATE' if m.get('exactDuplicateOf') else 'NEAR_DUPLICATE' if i in NEAR else 'SAME_CHOREOGRAPHY_VARIANT' if any(i in g for g in GROUPS) else 'UNIQUE'
        roles = {'A':['normal'], 'B':['backup'], 'PARTNER':['partner'], 'SPECIAL':['boss','special'],
                 'UTILITY':['utility','reaction'], 'EXPLORE':['explore'], 'REJECT':[]}[d['status']].copy()
        if i in FINISH: roles.append('finish')
        mode = dict(pop_casual=['pop','casual'], social_swing=['social','swing'], modern_stage=['modern','stage','performance'],
                    world_folk=['world','folk'], street_break=['battle','boss'], party_reaction=['party','reaction','waiting-room'])[d['stylePrimary']].copy()
        if partner_required(i): mode.append('duet')
        if int(i.split('_')[0]) in (60,61): mode=['social','latin','duet']
        if 'finish' in roles: mode+=['finish','special']
        secondary = ['modern_stage'] if i in ('88_10','111_02','111_04') else ['party_reaction'] if i.startswith('120_0') else []
        warnings = ['SOURCE_ONLY_NOT_RETARGETED', 'FIRST_SAMPLE_IS_CONVERTER_REFERENCE_TPOSE',
                    'FINGERS_NOT_CAPTURED', 'REST_AXES_REQUIRE_TARGET_CALIBRATION', 'OWNER_ACCEPTANCE_PENDING']
        if m['bodyAngular']['max_step_degrees'] > 30: warnings.append('BODY_ANGULAR_STEP_GT_30_DEG')
        if partner_required(i): warnings.append('PARTNER_CONTEXT_REQUIRED_NOT_SOLO_NORMAL')
        if d['floorWork'] in ('HAND_SUPPORTED','INVERTED','FLOOR_SPIN'): warnings.append('SUPPORT_AWARE_RETARGET_REQUIRED')
        if i.startswith('94_'): warnings.append('STYLE_FROM_SUBJECT_CONTEXT_TITLE_UNKNOWN')
        result.append(dict(id=m['id'], sourceId=i, **d, retained=retained, styleSecondary=secondary,
            partnerDependency='REQUIRED' if partner_required(i) else 'NONE',
            acrobaticRisk='HIGH' if d['energy']=='CLIMAX' or d['floorWork'] in ('INVERTED','HAND_SUPPORTED','FLOOR_SPIN') else 'LOW',
            modeHints=mode, roleHints=roles, duplicateOf=dupe, duplicateRelation=relation,
            choreographyGroup='cmu-'+group,
            visualStatus='EXACT_ALIAS_OF_REVIEWED_SOURCE' if m.get('exactDuplicateOf') else 'SOURCE_KEYPOSES_REVIEWED',
            reviewScope=dict(contactSheets=True, allFullVideosWatchedRealtime=False,
                             ownerAccepted=False, texturedTargetsReviewed=False), warnings=warnings))
    return result


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--out', type=Path, required=True); a=ap.parse_args()
    inventory=json.loads((a.out/'inventory.json').read_text())['motions']
    rows=decisions(inventory)
    write_json(a.out/'curation-decisions.json', rows)
    write_json(a.out/'retarget-poc-recommendations.json', [dict(category=c, sourceIds=i, rationale=r) for c,i,r in POCS])
    print('Retained', sum(m['retained'] for m in rows), 'of', len(rows))


if __name__=='__main__': main()
