# Visual QA Checklist

Inspect every generated keyframe at normal view and close detail before marking it complete.

## Contents

1. Status definitions
2. Hard failures
3. Soft failures
4. Character checks
5. Scene and composition checks
6. Logo, text, and interface checks
7. Technology overlay checks
8. Continuity checks
9. Medium-specific checks
10. Recording results

## Status definitions

- **通过**: production-usable; identity, composition, action, references, and continuity are correct.
- **需轻微修改**: usable structure with a local correctable issue that does not require rethinking the frame.
- **需重新生成**: core composition, identity, action, or anatomy is wrong.
- **缺少参考图**: a required identity, logo, product, or real scene cannot be validated.

## Hard failures

Mark `需重新生成` for:

- wrong person or identity drift;
- incorrect person count;
- wrong scene or incompatible camera angle;
- missing dominant action;
- severe hand, limb, or body deformation;
- object-body penetration affecting the action;
- incorrect or redesigned logo;
- required title missing or materially wrong;
- product interface replaced by an unrelated design;
- a technology panel covering the face or hands;
- dependent frames no longer matching the same continuity group;
- a still frame depicting mutually incompatible stages at once.

## Soft failures

Mark `需轻微修改` for:

- small exposure or color mismatch;
- noncritical background clutter;
- minor crop imbalance;
- slightly weak panel hierarchy;
- a secondary icon inconsistency;
- small nonessential text artifacts that can be removed without changing the composition.

## Character checks

- Count all visible people.
- Compare face, age, hairstyle, costume, accessories, and body proportions with the assigned reference.
- Verify gaze and expression fit the script.
- Verify hands contact the intended object.
- Check fingers, wrists, elbows, shoulders, legs, and occluded limbs.
- Check that clothing, hair, lanyards, and tools do not pass through the body.

## Scene and composition checks

- Confirm aspect ratio, shot size, viewpoint, and visual center.
- Confirm the required subject is not too small.
- Compare architecture, furniture, screens, doors, windows, and major props with the scene reference.
- Verify foreground objects do not unintentionally block the action.
- Verify vertical and horizontal perspective is plausible.
- Confirm split-screen or module proportions match the plan.

## Logo, text, and interface checks

- Compare logo geometry, color, gradient, negative space, and independent symbols.
- Read every required title character by character.
- Confirm capitalization such as `Teleagent` versus `TELEAGENT` matches the request.
- Confirm no extra title, watermark, badge, or random label appears.
- Confirm product-page layout, navigation, logo, and major functional regions match its reference.
- Treat tiny generated UI text as non-authoritative unless exact text was explicitly required.

## Technology overlay checks

- Confirm each panel has a clear semantic purpose.
- Confirm flow direction matches the process.
- Confirm panel count and hierarchy are controlled.
- Confirm panels do not cross faces, hands, bodies, monitors, or keyboards.
- Confirm blue glow does not darken the office or overpower skin tones.
- Reject unrelated cyberpunk decoration, excessive particles, or random code.

## Continuity checks

Compare each frame with the master and immediate predecessor:

- same person and costume;
- same room geometry;
- same desk, chair, monitor, and prop positions unless intentionally changed;
- same time of day and light direction;
- same rendering style and color treatment;
- plausible spatial progression between start, middle, and end states.

Record every intentional change in `允许变化`. If an unlisted change occurs, treat it as continuity drift.

## Medium-specific checks

### Live action

Check natural skin, documentary realism, plausible office light, restrained expressions, and absence of waxy or synthetic faces.

### Flat MG

Check equal module weight, consistent line width, clean arrows, stable labels, uncluttered spacing, and no unwanted 3D perspective.

### Colored pencil

Check that only the surface style changed. Preserve original structure, text, arrows, characters, and color relationships.

### 3D Chinese animation

Check that the subject remains a 3D animated character rather than a real person or 2D illustration. Verify CG material consistency, natural hair and cloth, and stable character design.

### Architecture

Check continuous walls, closed corners, aligned floors, complete window frames, glass embedded in walls, consistent reflections, and unchanged facade design.

## Recording results

For each frame, record:

- keyframe ID;
- image path;
- generation status;
- QA status;
- concise issue list;
- version number;
- timestamp;
- modification note.

Use objective descriptions such as `右手出现六指` or `标题“需求痛点”第三字错误`, not vague notes such as `看起来不太对`.

Before delivery, confirm that every required keyframe has a file path and a final status. Do not count unresolved hard failures as complete.
