[keyframe-prompt-rules.md](https://github.com/user-attachments/files/31247818/keyframe-prompt-rules.md)
# Keyframe Prompt Rules

Write prompts for a single frozen image. The downstream video stage owns motion, timing, and transitions.

## Contents

1. Prompt order
2. Freeze the moment
3. One dominant action
4. Reference-role wording
5. Camera and composition
6. People and actions
7. Technology panels
8. Text policy
9. Style modules
10. Positive prompt template
11. Negative prompt template

## Prompt order

Use this order so constraints are easy to audit:

1. task and reference roles;
2. output medium and aspect ratio;
3. camera and composition;
4. subjects and positions;
5. frozen action and expression;
6. foreground, middle ground, and background;
7. interface, graphics, or effects;
8. lighting, color, and finish;
9. exact text policy;
10. locked attributes;
11. allowed changes;
12. negative constraints.

## Freeze the moment

Use visible-state language:

- `画面定格在……的瞬间`
- `人物双手正接触键盘`
- `一张Skill卡片处于接入Agent核心的中间位置`
- `右侧工作流已有三个节点点亮，其余保持低亮度`

Avoid full-sequence language:

- `随后走过去`
- `不断弹出`
- `逐渐变成`
- `最后显示`
- `先……再……然后……`

If a sequence is necessary, create start/end or start/middle/end keyframes and put the transition in the motion summary.

## One dominant action

Give each frame one primary visual action. Secondary gestures may support it but must not compete. Avoid combining discussion, coding, walking, handshaking, page transformation, and department overview in one still.

## Reference-role wording

Assign each reference a specific responsibility:

```text
以R01作为人物身份依据，锁定脸型、五官、发型和年龄；
以R02作为会议室空间与镜头构图依据；
以R03作为Teleagent Logo图案依据，只允许调整尺寸；
以5A-K1作为同一场景连续性依据，保持桌椅与光线不变。
```

Do not write `综合参考所有图片` when the images control different attributes.

## Camera and composition

Always state aspect ratio, viewpoint, shot size, subject placement, and visual center. Specify whether a monitor faces the camera or the character. State what the camera can and cannot see when screen visibility matters.

Use plausible photographic language for live-action frames: eye level, slight low angle, 35mm, 50mm, or 85mm only when it materially affects the result. Do not stack contradictory lens and framing instructions.

## People and actions

Describe:

- person count;
- left, center, or right position;
- seated or standing posture;
- body orientation;
- gaze target;
- exact hand-object contact;
- restrained expression;
- relationship to nearby people and equipment.

For hands, prefer simple, physically supported poses. State `双手自然接触键盘` rather than demanding simultaneous typing and hologram manipulation. Keep objects from intersecting hands, faces, or bodies.

## Technology panels

Treat technology panels as explanatory overlays unless the script explicitly makes them physical displays. Define their business meaning, location, number, hierarchy, and connection direction.

Use icons, nodes, arrows, charts, short labels, and status shapes. Place panels behind or beside the subject without blocking the face, hands, keyboard, or monitor. Avoid decorative science-fiction panels that do not explain the process.

Examples of semantic panel families:

- Echo: customer pain points, demand categories, feedback, priorities;
- Delta: structured demand input, functional decomposition, project workflow, customized output;
- Foundry: Skill workflow construction, packaging, validation state, connection to Agent;
- MG process: modules, directional arrows, activation states, feedback loop.

## Text policy

Request exact text only when the shot needs it. Quote it exactly and keep it short. Limit each frame to a few required strings.

Represent nonessential text as blurred lines or icon-based information. For interfaces with many small labels, preserve the screenshot layout and major headings, then plan exact typography as post-production when necessary.

Never allow the model to invent additional titles, badges, signs, watermarks, or random text.

## Style modules

### Live-action corporate

Use real Chinese enterprise environments, bright daylight mixed with cool-white office lighting, restrained cool blue-white grade, natural skin texture, documentary authenticity, and polished corporate-film photography. Avoid staged smiles, dark cyberpunk scenes, and excessive holographic glow.

### Flat MG animation

Use clean two-dimensional vector-like shapes, Morandi palette when requested, equal visual weight across modules, consistent line width, clear arrows, simple characters, and uncluttered backgrounds. Preserve module structure and labels. Avoid pseudo-3D depth, busy diagrams, and ornamental particles.

### Colored-pencil illustration

Preserve the source structure, characters, labels, and arrows. Change only surface treatment: visible colored-pencil strokes, soft paper grain, controlled edges, layered pencil shading, and stable original palette. Avoid watercolor bleeding or redesigning the diagram.

### 3D Chinese animation

State explicitly that the subject is a high-quality 3D animated character, not a photographed human. Preserve the character-design reference, use refined CG skin with subtle subsurface scattering, PBR fabric and hair, cinematic but coherent lighting, and natural animation-ready anatomy. Avoid influencer faces, photoreal selfie style, plastic skin, oversized 2D eyes, and cheap game-model appearance.

### Architecture

Use the reference building as the sole design source. Preserve massing, floors, facade divisions, windows, roof, entrances, and logos. Require continuous wall surfaces, closed corners, aligned joints, embedded window frames, planar glass, consistent reflections, and corrected vertical perspective. Do not redesign the building.

## Positive prompt template

```text
【任务与参考】
以[reference IDs and roles]为依据，生成[frame ID]关键帧。

【画幅与镜头】
[aspect ratio]，[viewpoint]，[shot size]，[camera behavior represented as a static composition]。

【画面定格】
画面定格在[one dominant visible action]的瞬间。[subjects, positions, gaze, hands, props]。

【空间与信息层级】
[foreground, middle ground, background, interface/effect state]。

【风格与光线】
[medium, palette, lighting, finish]。

【文字】
只显示[exact required strings]；其余信息使用图标或模糊线条表示。

【严格保持】
[locked attributes]。

【允许变化】
[explicitly allowed changes]。
```

## Negative prompt template

```text
避免改变人物身份、数量、年龄、发型、服装和场景结构；避免错误Logo、随机文字、乱码、额外标题和水印；避免多余手指、肢体畸形、穿模、悬浮物体和错误接触；避免科技面板遮挡面部、双手或设备；避免镜头角度、景别、光线和画面比例漂移；避免加入未要求的人物、道具、建筑或强烈特效。
```

Customize the negative prompt. Do not paste every possible negative constraint into every frame when it is irrelevant.
