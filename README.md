# generate-script-keyframes

将视频脚本表格转换为可执行的镜头拆解、关键帧提示词和图片生成计划。

该 Skill 位于视频制作工作流的中间环节：读取上游脚本 Excel，拆分复杂镜头，匹配人物、场景、Logo、产品界面等参考图，为每个子镜头规划关键帧，并整理成可供图片生成与后续图生视频使用的工作簿。

## 工作流程

```text
视频脚本 Excel
    ↓
提取镜号与画面内容
    ↓
拆分子镜头与视觉节拍
    ↓
匹配参考图和连续性约束
    ↓
编写关键帧提示词
    ↓
生成关键帧规划工作簿
    ↓
生成图片、视觉质检与结果回写
    ↓
输出图生视频交接数据
```

## 主要能力

- 读取 `.xlsx`、`.csv`、`.tsv` 视频脚本。
- 自动识别 `镜号`、`时长`、`景别/运镜`、`画面内容`、`旁白`、`字幕/特效`、`拍摄备注` 等字段。
- 将包含多个场景、视角或视觉状态的复杂镜头拆分为子镜头。
- 为每个子镜头规划 1—3 张关键帧，包括首帧、中间状态和终帧。
- 管理人物、服装、场景、Logo、产品界面、视觉风格及前序关键帧参考。
- 编写适用于静态图片生成的正向提示词和负面约束。
- 检查人物一致性、构图、文字、Logo、界面结构、肢体和镜头连续性。
- 输出后续图生视频需要的首尾帧、动作摘要和运镜信息。

## 输入表格

表格至少需要包含以下两列：

| 必需字段 | 说明 |
| --- | --- |
| `镜号` | 原始镜头编号 |
| `画面内容` | 场景、人物、动作和视觉效果描述 |

以下字段可作为辅助约束：

- `时长`
- `景别/运镜`
- `旁白`
- `字幕/特效`
- `拍摄备注`

## 输出内容

默认生成一份关键帧规划工作簿，包含：

- `项目摘要`
- `原始脚本`
- `镜头拆解`
- `参考图清单`
- `关键帧规划`
- `生成结果`
- `视频片段交接`

在图片生成模式下，还会输出按关键帧 ID 命名的图片文件及对应的视觉质检结果。

## 使用方式

在支持 Skills 的 ChatGPT 或 Codex 环境中调用：

```text
使用 $generate-script-keyframes 读取我的视频脚本 Excel，拆分镜头并生成关键帧规划。
```

如果只需要提示词，可以说明：

```text
使用 $generate-script-keyframes 提取脚本中的镜头，完成子镜头拆分和关键帧提示词，不生成图片。
```

如果已经确认方案并希望直接生成关键帧：

```text
使用 $generate-script-keyframes 按自动模式完成镜头拆解、提示词和关键帧生成。
```

## 命令行脚本

```bash
# 1. 提取并标准化脚本表格
node scripts/extract-storyboard.mjs \
  --input video-script.xlsx \
  --output storyboard.json

# 2. 根据拆解计划生成关键帧工作簿
node scripts/build-keyframe-workbook.mjs \
  --source-json storyboard.json \
  --plan keyframe-plan.json \
  --output keyframe-plan.xlsx

# 3. 将图片生成和质检结果写回工作簿
node scripts/update-generation-results.mjs \
  --workbook keyframe-plan.xlsx \
  --results generation-results.json \
  --output keyframe-plan-reviewed.xlsx
```

## 项目结构

```text
generate-script-keyframes/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── extract-storyboard.mjs
│   ├── build-keyframe-workbook.mjs
│   └── update-generation-results.mjs
└── references/
    ├── shot-decomposition-rules.md
    ├── reference-image-rules.md
    ├── keyframe-prompt-rules.md
    └── visual-qa-checklist.md
```

## 设计原则

- 不改写原脚本的叙事含义。
- 不覆盖用户上传的源表格。
- 不把章节标题误识别为镜头。
- 不仅按标点机械拆分镜头。
- 单个子镜头不超过 3 张关键帧。
- 静态关键帧提示词只描述一个明确冻结状态。
- 未提供参考图时，不虚构具体人物、真实建筑、品牌 Logo 或产品界面。
- 默认先输出规划供用户确认，再执行图片生成。

## 适用场景

- 企业宣传片
- 产品介绍片
- MG 动画与流程动画
- AI 短视频
- 剧情短片与动漫分镜
- 图生视频首尾帧规划

