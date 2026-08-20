# Reference Image Rules

Build an explicit reference registry before generating prompts or images. Treat references as production constraints, not vague inspiration.

## Contents

1. Reference types
2. Source priority
3. Registry fields
4. Matching procedure
5. Critical missing references
6. Continuity references
7. Multiple-reference conflicts
8. Brand and text handling
9. Project assets versus skill assets

## Reference types

| Type | Controls | Typical locked attributes |
| --- | --- | --- |
| Character identity | A real person or recurring fictional character | face, age, hairstyle, recognizable marks |
| Character design | A 2D or 3D character model | proportions, costume, accessories, material style |
| Costume | Clothing only | color, cut, logo placement, accessories |
| Scene | A real or recurring location | architecture, furniture, spatial relationships |
| Composition | Camera and layout only | viewpoint, subject placement, crop, negative space |
| Logo | Exact brand mark | geometry, color, gradient, star or symbol details |
| Product interface | Real screen or application | layout, navigation, logo, major cards and regions |
| Visual style | Treatment only | rendering medium, palette, line quality, lighting |
| Approved frame | Continuity source | all approved visible attributes unless explicitly changed |

## Source priority

Use the following order when references conflict:

1. the user's explicit statement about a specific image;
2. an explicit mapping in the project's reference sheet or manifest;
3. a user-approved previous keyframe in the same continuity group;
4. an unambiguous filename or object match;
5. a reusable asset bundled with the skill;
6. the textual scene description.

Never let a generic style image override an explicit identity, logo, scene, or product reference.

## Registry fields

Record:

- reference ID;
- type;
- subject name;
- local file path;
- applicable original shots or subshots;
- exact purpose;
- locked attributes;
- allowed changes;
- priority;
- status;
- ambiguity note.

Use stable IDs such as `R01`, `R02`. Store file paths or attachment identifiers in the workbook; do not embed every image into the workbook by default.

## Matching procedure

1. Inventory all available images.
2. Inspect each image before use.
3. Apply explicit user mappings first.
4. Match subject names, filenames, and shot descriptions.
5. Assign the minimum set of references needed by each subshot.
6. Flag conflicts and critical gaps.
7. Reuse approved previous frames for dependent frames.

Do not attach every reference to every prompt. Excess references dilute control and may mix identities or layouts.

## Critical missing references

Stop and ask when the shot requires:

- a specific real person;
- a recurring character whose identity must remain stable;
- an exact corporate or product logo;
- an exact product page;
- a real building or office that must be reproduced;
- a user-selected image that is unavailable locally.

Continue without asking when the missing reference concerns a generic office, abstract data, general city view, background plant, ordinary device, or non-specific employee. Mark the row `无参考图，原创生成`.

## Continuity references

Create a continuity group whenever multiple frames share a person, location, props, or style. Generate or approve a master frame first. Use this master or the nearest approved predecessor to control later frames.

For a dependent frame, list:

- attributes inherited unchanged;
- attributes intentionally changed;
- the immediate predecessor frame;
- any new reference introduced.

Never regenerate a dependent frame from text alone when a valid approved predecessor is available.

## Multiple-reference conflicts

If references disagree, split control by role. Example:

- image 1 controls face and hairstyle;
- image 2 controls pose and composition;
- image 3 controls logo;
- image 4 controls product page.

State these roles directly in the prompt. Do not use broad language such as “参考所有图片” without assigning responsibilities.

When two images both claim the same role and disagree materially, ask the user to choose. Do not average faces, merge costumes, or redesign logos.

## Brand and text handling

Use the exact logo reference as a flat graphic source. Preserve geometry, color, gradient, negative space, and independent symbols. Do not redraw it from memory.

For product interfaces, preserve major layout, logo, side navigation, functional-card positions, and color hierarchy. Avoid promising exact tiny text. Use the screenshot as a compositing or structural reference and reserve exact text for post-production when fidelity is critical.

## Project assets versus skill assets

Keep project-specific people, clients, offices, internal screenshots, and unpublished assets outside the skill. Accept them with each task.

Bundle only stable reusable assets whose use is authorized, such as a standard workbook template or persistent brand mark. Never silently retain a user's one-off reference inside the skill.
