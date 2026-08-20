# Shot Decomposition Rules

Use these rules to convert an original spreadsheet row into production-safe subshots and keyframes. Base decisions on visual continuity, not punctuation count.

## Contents

1. Terms
2. Decomposition sequence
3. Mandatory subshot boundaries
4. Keep within one subshot
5. Split-screen and montage
6. Keyframe count
7. Duration guidance
8. Identifier rules
9. Decision examples
10. Final check

## 1. Terms

- **Original shot**: one source row identified by `镜号`.
- **Visual beat**: one observable subject-action-state unit within the row.
- **Subshot**: one continuous composition suitable for one video-generation request.
- **Keyframe**: one frozen state inside a subshot.
- **Continuity group**: frames that must preserve the same identity, location, props, and visual treatment.

## 2. Decomposition sequence

1. Extract subjects, locations, actions, props, screens, effects, and explicit camera instructions.
2. Order them by the sequence implied by the description.
3. Group beats that can occur continuously in one composition.
4. Split before any beat that needs a new location, subject, camera, medium, or incompatible screen state.
5. Assign subshot IDs without changing the original shot number.
6. Assign one to three keyframes to each subshot.

## 3. Mandatory subshot boundaries

Create a new subshot when any of these changes materially:

- location or room;
- time period or explicit temporal jump;
- primary subject or speaking focus;
- main character set;
- camera side, angle, or point of view;
- shot size, such as full shot to eye close-up;
- visual medium, such as live action to flat MG animation;
- composition type, such as single scene to multi-panel overview;
- dominant physical device or product screen;
- state that cannot plausibly coexist in one frozen image;
- production method, such as a real office plate followed by a fully graphic process diagram.

Treat an explicit hard cut, match cut, screen takeover, or scene transition as a subshot boundary.

## 4. Keep within one subshot

Do not split solely for:

- typing, mouse movement, nodding, blinking, breathing, or a small hand gesture;
- a speaker turning toward another person without changing the composition;
- arrows drawing, light traveling, data flowing, cards entering, or nodes lighting up;
- a restrained camera push that does not change the dominant framing;
- a technology panel appearing behind the same subject;
- a character opening one folder and immediately taking out one sheet when the action is meant to be continuous.

Store these changes in the motion summary or use start/end keyframes.

## 5. Split-screen and montage

Preserve one composite subshot when the script explicitly requests simultaneous comparison, split screen, department overview, or a single MG process board. Record each panel as a component of the same composition.

Split panels into separate subshots when:

- the video will zoom into each panel sequentially;
- the image-to-video tool cannot preserve all panels reliably;
- each panel uses a different camera or visual style;
- the user asks for enlarged emphasis frames;
- text or character detail would become unreadable in the composite.

When both are useful, create one overview subshot plus separate emphasis subshots. Do not call emphasis frames additional keyframes if they require a different composition.

## 6. Keyframe count

Use one keyframe for a stable office discussion, portrait, establishing view, or completed diagram with only subtle motion.

Use two keyframes for:

- empty-to-populated interface;
- inactive-to-highlighted module;
- character at position A to position B;
- object before and after opening;
- paper before and after contacting a display;
- a scene intended for start-frame/end-frame video generation.

Use three keyframes only when the middle form matters, such as paper approaching a screen, partially merging, and fully becoming a product page.

If the fourth state introduces new visual information, create another subshot.

## 7. Duration guidance

- Under 3 seconds: usually one subshot and one keyframe.
- 3–5 seconds: usually one subshot with one or two keyframes.
- 5–8 seconds: inspect for two visual beats; split if the camera or subject changes.
- Over 8 seconds: usually split when more than one major visual event occurs.

Do not use duration alone. A ten-second static interview may remain one subshot; a three-second hard-cut montage may require several.

## 8. Identifier rules

- Preserve the original value in `原镜号`.
- Use the original shot number as the subshot ID when no split is needed.
- Append `A`, `B`, `C` in sequence when splitting: `5A`, `5B`, `5C`.
- Use `5A-K1`, `5A-K2`, `5A-K3` for frames.
- Never reuse a subshot or keyframe ID.
- If the source repeats a shot number, retain its source row and create a stable internal source ID before decomposition.

## 9. Decision examples

**One continuous subshot**: “两人坐在会议桌旁交流，顾问做手势，随后科技需求面板在背后点亮。” The location, subjects, and camera remain stable. Use one subshot and up to two keyframes.

**Multiple subshots**: “FDE现场收集需求→后端接收→Teleagent封装Skill→一线使用。” The subjects, location, screen state, and production focus change. Split into four subshots.

**Three keyframes, not three subshots**: “角色把Logo纸张推向显示器，纸张接触屏幕后融合成产品页面。” Keep the camera and scene; use approach, partial merge, and completed screen states.

**Overview plus emphasis**: “五个模块始终存在，箭头走到哪里，哪个模块放大变亮。” Create one overview composition and separate emphasis subshots only when enlarged detail frames are required for generation.

## 10. Final check

For every proposed subshot, ask:

1. Can one camera observe the whole action continuously?
2. Can one still image represent its dominant state without contradiction?
3. Can a three-to-five-second video prompt animate it without introducing a second scene?
4. Does its first frame connect visually to the previous subshot?

If the answer to the first three is no, split. If only the fourth is no, revise the transition or continuity group.
