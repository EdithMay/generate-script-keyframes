---
name: generate-script-keyframes
description: Convert video-script spreadsheets into production-ready subshot and keyframe plans, match user-provided character, scene, logo, product-interface, style, and approved-frame references, write still-image prompts, generate continuity-safe storyboard images, perform visual QA, and prepare handoff data for image-to-video generation. Use when a user provides an .xlsx, .csv, or .tsv shot list and asks to extract shots, split complex shots, plan or generate keyframes, create storyboard prompts, preserve references across frames, or prepare start/end frames for video clips.
---

# Generate Script Keyframes

Transform an upstream video-script spreadsheet into a reviewed keyframe package. Keep this skill limited to the middle production stage: read the script, decompose shots, plan keyframes, map references, write static-image prompts, generate images when authorized, verify them, and prepare downstream video handoff data. Do not rewrite the script or generate video clips.

## Operating modes

Choose the narrowest mode that satisfies the request:

- **Plan**: extract the spreadsheet, decompose shots, and create the planning workbook.
- **Prompt**: also write complete positive and negative prompts.
- **Generate**: also create keyframe images, inspect them, and record results.
- **Auto**: skip the review gate only when the user explicitly says to generate directly or use automatic mode.

Default to **Prompt**, show the decomposition summary, and wait before image generation.

## Inputs

Require a spreadsheet with usable `镜号` and `画面内容` columns. Accept `.xlsx`, `.csv`, and `.tsv`. Treat these as optional but important constraints when present:

- `时长`
- `景别/运镜`
- `旁白`
- `字幕/特效`
- `拍摄备注`

Accept optional image attachments as character, character-design, costume, scene, composition, logo, product-interface, visual-style, or approved-previous-frame references. Do not assume every shot needs every reference type.

## Spreadsheet contract

Use the spreadsheet tooling and follow its authoring and verification requirements. Never overwrite the source workbook. Match headers by normalized names rather than fixed column letters. Ignore empty decorative columns. Preserve chapter rows as context rather than treating them as shots.

Use `scripts/extract-storyboard.mjs` to convert the source spreadsheet into normalized JSON:

```bash
$CODEX_PRIMARY_RUNTIME_NODE scripts/extract-storyboard.mjs \
  --input /path/to/video-script.xlsx \
  --output /tmp/storyboard.json
```

The extractor preserves raw values, normalizes HTML line breaks and timecodes, reports duplicate shot numbers, and retains source row numbers for auditability.

## Workflow

### 1. Inspect and normalize

Read every worksheet and select the best shot-list sheet unless the user specifies one. Detect empty rows, merged-layout artifacts, chapter titles, duplicate shot numbers, missing descriptions, and malformed durations. Preserve raw values and report corrections separately. Interpret `00:62` as elapsed time `01:02`, but never silently replace the source value.

Use `镜号` and `画面内容` as the primary visual source. Use `时长`, `景别/运镜`, `字幕/特效`, and `拍摄备注` as production constraints. Use `旁白` to verify communication intent; do not literalize every narrated phrase.

### 2. Build the reference registry

Inventory uploaded images before writing prompts. Assign stable IDs such as `R01`, `R02`, and record type, subject, file path, applicable shots, purpose, locked attributes, allowed changes, and matching status.

Apply this priority:

1. explicit user mapping;
2. unambiguous user filename or subject match;
3. approved frame from the same continuity group;
4. reusable asset bundled with this skill;
5. text-only original generation.

Do not browse for references unless explicitly asked. Do not fabricate a specific person, real building, exact logo, or real product interface. Ask only when a missing or ambiguous critical reference changes identity or brand accuracy. Continue with generic offices, abstract data, or non-specific backgrounds and mark them `无参考图，原创生成`.

Read [reference-image-rules.md](references/reference-image-rules.md) before resolving references.

### 3. Decompose original shots into subshots

Parse each visual description into ordered visual beats. Preserve the original shot number and create subshot IDs such as `5A`, `5B`, and `5C`.

Create a new subshot when location, primary subject, main character, camera angle, shot size, visual medium, time period, or dominant screen state changes enough to require a different composition or video clip. Keep typing, nodding, pointing, blinking, light flow, arrow movement, and node highlighting within one subshot when they remain continuous.

Preserve explicit split-screen, montage, or overview compositions unless downstream animation requires each panel separately. Never place unrelated locations or incompatible camera angles in one generated image merely because they share an original shot number.

Read [shot-decomposition-rules.md](references/shot-decomposition-rules.md) before finalizing the plan.

### 4. Determine keyframe count

Assign one to three keyframes per subshot:

- **1** for a stable composition or single establishing state.
- **2** for a clear start/end change or when the video stage needs both endpoints.
- **3** only when the intermediate state is indispensable to control a transformation.

If more than three are needed, split the subshot again. Prefer three-to-five-second downstream clips, but prioritize visual logic over rigid duration. Name frames `5A-K1`, `5A-K2`, and `5A-K3`. Classify each as `单帧场景`, `首帧`, `中间状态`, `终帧`, or `转场衔接帧`.

### 5. Write static keyframe prompts

Describe the visible frozen moment, not the whole movement. Use one dominant action per frame. Replace temporal phrases such as `随后`, `逐渐`, `不断`, and `最后` with a precise visible state. Put motion between frames into the downstream motion summary.

Specify reference roles, aspect ratio, camera, shot size, subject positions, gaze, hand action, foreground/middle/background, props, interface state, lighting, style, exact text, locked attributes, allowed changes, and negative constraints.

Generate exact text only when necessary. Quote required text exactly. Represent secondary UI content with icons, lines, charts, nodes, cards, or blurred text blocks. Keep explanatory technology panels semantically relevant and away from faces, hands, bodies, and primary equipment.

Read [keyframe-prompt-rules.md](references/keyframe-prompt-rules.md) before writing prompts.

### 6. Create the planning workbook

Prepare a model-authored plan JSON following the schema documented by `scripts/build-keyframe-workbook.mjs --help`, then build the workbook:

```bash
$CODEX_PRIMARY_RUNTIME_NODE scripts/build-keyframe-workbook.mjs \
  --source-json /tmp/storyboard.json \
  --plan /tmp/keyframe-plan.json \
  --output /path/to/keyframe-plan.xlsx \
  --preview-dir /tmp/keyframe-previews
```

Create these sheets:

- `项目摘要`
- `原始脚本`
- `镜头拆解`
- `参考图清单`
- `关键帧规划`
- `生成结果`
- `视频片段交接`

Keep stable identifiers in every sheet. Include source row, original shot, subshot, keyframe, continuity group, reference IDs, prompts, image paths, QA status, and downstream motion fields.

### 7. Apply the review gate

Before image generation, report original shot count, subshot count, keyframe count, workbook warnings, missing critical references, and ambiguous mappings. Wait for confirmation unless the user selected **Auto** or explicitly asked to generate directly.

### 8. Generate continuity-safe images

Use the image-generation tool after authorization. Inspect each local reference image before using it. Generate the first approved frame of each continuity group as its master. Use the master or previous approved frame for later dependent frames. Generate independent continuity groups separately.

Preserve character identity, face, hairstyle, costume, age, scene geometry, equipment placement, logo geometry, product-interface structure, style, and lighting direction as required by the reference registry. Do not generate dependent frames independently when an approved predecessor exists.

Name files by keyframe ID, for example `S05A-K1.png`.

### 9. Inspect and record results

Inspect every generated image. Apply [visual-qa-checklist.md](references/visual-qa-checklist.md). Classify each result as `通过`, `需轻微修改`, `需重新生成`, or `缺少参考图`.

Write generation and QA results back without damaging workbook formatting:

```bash
$CODEX_PRIMARY_RUNTIME_NODE scripts/update-generation-results.mjs \
  --workbook /path/to/keyframe-plan.xlsx \
  --results /tmp/results.json \
  --output /path/to/keyframe-plan-reviewed.xlsx \
  --preview-dir /tmp/reviewed-previews
```

Regenerate only failed frames. When a failure concerns exact text, logo geometry, character identity, or severe anatomy, classify it as a hard failure rather than accepting approximate similarity.

### 10. Deliver

Return the reviewed workbook, generated keyframe files, and a contact sheet in shot order when images were generated. Summarize unresolved references and failed QA items. Do not claim completion while required frames are missing or critical continuity defects remain.

## Boundaries

- Do not rewrite the script's narrative meaning.
- Do not overwrite the source spreadsheet.
- Do not use chapter rows as shots.
- Do not split by punctuation alone.
- Do not exceed three keyframes per subshot.
- Do not describe a full motion sequence inside a still-image prompt.
- Do not generate multiple incompatible scenes in one image unless the script explicitly requires a composite layout.
- Do not invent exact people, logos, product screens, or real locations without references.
- Do not generate images before the review gate unless explicitly authorized.
- Do not generate video clips; populate `视频片段交接` for the downstream stage.
