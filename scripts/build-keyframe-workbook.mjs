#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const PLAN_SCHEMA = `{
  "schema_version": "1.0",
  "project": {"title": "项目名称", "aspect_ratio": "16:9", "mode": "Prompt"},
  "references": [{
    "reference_id": "R01", "type": "人物身份", "subject": "Echo",
    "file_path": "/path/echo.png", "applies_to": ["3A"], "purpose": "人物身份",
    "locked_attributes": "五官、发型、年龄", "allowed_changes": "姿势、表情",
    "priority": 1, "status": "已匹配", "note": ""
  }],
  "subshots": [{
    "source_id": "SRC-R0002", "original_shot_number": "3", "subshot_id": "3A",
    "sequence": 1, "suggested_duration_seconds": 4, "scene": "企业会议室",
    "subject": "Echo与客户经理", "core_action": "站立讨论需求痛点",
    "camera": "正面平视中景", "split_reason": "原镜头包含多个场景",
    "continuity_group": "CG-ECHO-MEETING", "reference_ids": ["R01"],
    "motion_summary": "两人自然交流并做手势", "effects_summary": "科技需求面板逐项点亮"
  }],
  "keyframes": [{
    "subshot_id": "3A", "keyframe_id": "3A-K1", "sequence": 1,
    "time_position": "起始", "purpose": "首帧", "shot_camera": "正面平视中景",
    "visible_state": "两人站在数字屏幕前讨论", "reference_ids": ["R01"],
    "continuity_locks": "人物身份、会议室结构、服装", "allowed_changes": "手势",
    "prompt": "完整静态关键帧Prompt", "negative_prompt": "负面Prompt"
  }]
}`;

function usage(exitCode = 0) {
  const text = `Usage:
  build-keyframe-workbook.mjs --source-json <storyboard.json> --plan <plan.json> --output <plan.xlsx> [--preview-dir <dir>]

Plan JSON schema example:
${PLAN_SCHEMA}`;
  console[exitCode === 0 ? "log" : "error"](text);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") usage(0);
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  if (!args["source-json"] || !args.plan || !args.output) usage(1);
  return args;
}

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch (primaryError) {
    const modulesRoot = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
    if (!modulesRoot) throw primaryError;
    const require = createRequire(import.meta.url);
    const entry = require.resolve("@oai/artifact-tool", { paths: [modulesRoot] });
    return import(pathToFileURL(entry).href);
  }
}

function text(value) {
  if (value === null || value === undefined) return "";
  return Array.isArray(value) ? value.map(text).filter(Boolean).join("、") : String(value).trim();
}

function numberOrBlank(value) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : text(value);
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`Plan field '${name}' must be an array.`);
  return value;
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (!value) throw new Error(`${label} contains an empty identifier.`);
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return seen;
}

function validate(source, plan) {
  if (!Array.isArray(source.shots) || source.shots.length === 0) throw new Error("Source JSON contains no shots.");
  const subshots = assertArray(plan.subshots, "subshots");
  const keyframes = assertArray(plan.keyframes, "keyframes");
  const references = plan.references === undefined ? [] : assertArray(plan.references, "references");
  if (subshots.length === 0) throw new Error("Plan contains no subshots.");
  if (keyframes.length === 0) throw new Error("Plan contains no keyframes.");

  const sourceIds = new Set(source.shots.map((shot) => text(shot.source_id)));
  const subshotIds = unique(subshots.map((item) => text(item.subshot_id)), "subshot_id");
  unique(keyframes.map((item) => text(item.keyframe_id)), "keyframe_id");
  const referenceIds = unique(references.map((item) => text(item.reference_id)), "reference_id");

  for (const item of subshots) {
    if (!sourceIds.has(text(item.source_id))) throw new Error(`Subshot ${item.subshot_id} references unknown source_id ${item.source_id}.`);
    for (const referenceId of item.reference_ids || []) {
      if (referenceId && !referenceIds.has(text(referenceId))) throw new Error(`Subshot ${item.subshot_id} references unknown reference ${referenceId}.`);
    }
  }

  const counts = new Map();
  for (const frame of keyframes) {
    const subshotId = text(frame.subshot_id);
    if (!subshotIds.has(subshotId)) throw new Error(`Keyframe ${frame.keyframe_id} references unknown subshot ${subshotId}.`);
    counts.set(subshotId, (counts.get(subshotId) || 0) + 1);
    for (const referenceId of frame.reference_ids || []) {
      if (referenceId && !referenceIds.has(text(referenceId))) throw new Error(`Keyframe ${frame.keyframe_id} references unknown reference ${referenceId}.`);
    }
  }
  for (const subshotId of subshotIds) {
    const count = counts.get(subshotId) || 0;
    if (count === 0) throw new Error(`Subshot ${subshotId} has no keyframe.`);
    if (count > 3) throw new Error(`Subshot ${subshotId} has ${count} keyframes; maximum is 3.`);
  }
}

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function styleTableSheet(sheet, headers, rowCount, widths, tableName) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  const lastColumn = columnName(headers.length - 1);
  const lastRow = Math.max(1, rowCount + 1);
  const header = sheet.getRange(`A1:${lastColumn}1`);
  header.format = {
    fill: "#1F4E78",
    font: { bold: true, color: "#FFFFFF", size: 11 },
    verticalAlignment: "center",
    horizontalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#17365D" },
  };
  header.format.rowHeight = 30;

  if (rowCount > 0) {
    const body = sheet.getRange(`A2:${lastColumn}${lastRow}`);
    body.format = {
      font: { color: "#1F2937", size: 10 },
      verticalAlignment: "top",
      wrapText: true,
      borders: {
        insideHorizontal: { style: "thin", color: "#D9E2F3" },
        bottom: { style: "thin", color: "#AFC4DE" },
      },
    };
    body.format.rowHeight = 42;
    const table = sheet.tables.add(`A1:${lastColumn}${lastRow}`, true, tableName);
    table.showFilterButton = true;
    table.showBandedRows = true;
  }

  widths.forEach((width, index) => {
    sheet.getRange(`${columnName(index)}1:${columnName(index)}${lastRow}`).format.columnWidth = width;
  });
}

function writeTable(workbook, name, headers, rows, widths, tableName) {
  const sheet = workbook.worksheets.getOrAdd(name);
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  if (rows.length > 0) sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
  styleTableSheet(sheet, headers, rows.length, widths, tableName);
  return sheet;
}

function sanitizeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "_");
}

function collectWarnings(source) {
  const items = [];
  for (const warning of source.warnings || []) {
    items.push({ location: warning.source_row ? `第${warning.source_row}行` : "工作簿", message: text(warning.message || warning) });
  }
  for (const shot of source.shots || []) {
    for (const warning of shot.warnings || []) {
      items.push({ location: `第${shot.source_row}行 / 镜号${shot.original_shot_number}`, message: text(warning) });
    }
  }
  return items;
}

function frameRole(frames, purpose) {
  return frames.find((frame) => text(frame.purpose) === purpose);
}

async function renderPreviews(workbook, directory) {
  await fs.mkdir(directory, { recursive: true });
  for (const sheet of workbook.worksheets.items) {
    const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
    const bytes = new Uint8Array(await preview.arrayBuffer());
    await fs.writeFile(path.join(directory, `${sanitizeFileName(sheet.name)}.png`), bytes);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(args["source-json"]);
  const planPath = path.resolve(args.plan);
  const outputPath = path.resolve(args.output);
  const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
  validate(source, plan);

  const { Workbook, SpreadsheetFile } = await loadArtifactTool();
  const workbook = Workbook.create();
  for (const sheetName of ["项目摘要", "原始脚本", "镜头拆解", "参考图清单", "关键帧规划", "生成结果", "视频片段交接"]) {
    workbook.worksheets.add(sheetName);
  }
  const project = plan.project || {};
  const references = plan.references || [];
  const subshots = [...plan.subshots].sort((a, b) => numberOrBlank(a.sequence) - numberOrBlank(b.sequence));
  const keyframes = [...plan.keyframes].sort((a, b) => {
    const subshotDelta = subshots.findIndex((item) => text(item.subshot_id) === text(a.subshot_id)) - subshots.findIndex((item) => text(item.subshot_id) === text(b.subshot_id));
    return subshotDelta || numberOrBlank(a.sequence) - numberOrBlank(b.sequence);
  });
  const warnings = collectWarnings(source);

  const summary = workbook.worksheets.getItem("项目摘要");
  summary.showGridLines = false;
  summary.getRange("A1:H1").merge();
  summary.getRange("A1").values = [[text(project.title) || "视频关键帧生产规划"]];
  summary.getRange("A1:H1").format = {
    fill: "#17365D",
    font: { bold: true, color: "#FFFFFF", size: 18 },
    horizontalAlignment: "left",
    verticalAlignment: "center",
  };
  summary.getRange("A1:H1").format.rowHeight = 38;
  summary.getRange("A3:B7").values = [
    ["项目信息", "值"],
    ["来源文件", text(source.source?.file_name)],
    ["来源工作表", text(source.source?.sheet_name)],
    ["画面比例", text(project.aspect_ratio) || "16:9"],
    ["工作模式", text(project.mode) || "Prompt"],
  ];
  summary.getRange("D3:E8").values = [
    ["统计指标", "数量"],
    ["原始镜头", ""],
    ["子镜头", ""],
    ["关键帧", ""],
    ["参考图", ""],
    ["提取警告", ""],
  ];
  summary.getRange("E4").formulas = [[`=COUNTA('原始脚本'!$A$2:$A$${source.shots.length + 1})`]];
  summary.getRange("E5").formulas = [[`=COUNTA('镜头拆解'!$C$2:$C$${subshots.length + 1})`]];
  summary.getRange("E6").formulas = [[`=COUNTA('关键帧规划'!$B$2:$B$${keyframes.length + 1})`]];
  summary.getRange("E7").values = [[references.length]];
  summary.getRange("E8").values = [[warnings.length]];
  summary.getRange("G3:H7").values = [
    ["交付检查", "状态"],
    ["镜头拆解", "待确认"],
    ["参考图匹配", references.some((item) => /缺失|待确认/.test(text(item.status))) ? "有待处理项" : "已登记"],
    ["关键帧Prompt", keyframes.every((item) => text(item.prompt)) ? "已完成" : "存在空缺"],
    ["图像生成", "未开始"],
  ];
  if (warnings.length > 0) {
    summary.getRange("A10:H10").merge();
    summary.getRange("A10").values = [["提取警告"]];
    summary.getRange("A10:H10").format = { fill: "#FFF2CC", font: { bold: true, color: "#7F6000" } };
    const warningRows = warnings.map((item, index) => [index + 1, item.location, item.message, "", "", "", "", ""]);
    summary.getRangeByIndexes(10, 0, warningRows.length, 8).values = warningRows;
    summary.getRange(`A11:H${10 + warningRows.length}`).format = { wrapText: true, verticalAlignment: "top" };
  }
  for (const range of ["A3:B3", "D3:E3", "G3:H3"]) {
    summary.getRange(range).format = { fill: "#5B9BD5", font: { bold: true, color: "#FFFFFF" } };
  }
  summary.getRange("A3:H8").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
  [18, 34, 3, 18, 15, 3, 20, 20].forEach((width, index) => {
    summary.getRange(`${columnName(index)}1:${columnName(index)}${Math.max(12, warnings.length + 10)}`).format.columnWidth = width;
  });

  const sourceRows = source.shots.map((shot) => [
    text(shot.source_id), shot.source_row, text(shot.chapter), text(shot.original_shot_number), shot.duplicate_index,
    text(shot.duration_raw), text(shot.normalized_time), numberOrBlank(shot.duration_seconds), text(shot.camera),
    text(shot.visual_content), text(shot.narration), text(shot.subtitle_effects), text(shot.production_notes), text(shot.warnings),
  ]);
  writeTable(workbook, "原始脚本",
    ["Source ID", "源行", "篇章", "原镜号", "重复序号", "原始时长", "规范时间", "时长秒", "景别/运镜", "画面内容", "旁白", "字幕/特效", "拍摄备注", "提取警告"],
    sourceRows, [14, 8, 24, 10, 9, 14, 14, 10, 20, 42, 36, 24, 30, 28], "SourceShotsTable");

  const subshotRows = subshots.map((item) => [
    text(item.source_id), text(item.original_shot_number), text(item.subshot_id), numberOrBlank(item.sequence),
    numberOrBlank(item.suggested_duration_seconds), text(item.scene), text(item.subject), text(item.core_action),
    text(item.camera), text(item.split_reason), text(item.continuity_group), text(item.reference_ids),
    text(item.motion_summary), text(item.effects_summary),
  ]);
  writeTable(workbook, "镜头拆解",
    ["Source ID", "原镜号", "子镜号", "顺序", "建议时长秒", "场景", "主体", "核心动作", "景别/机位", "拆分原因", "连续性组", "参考图ID", "视频动作摘要", "特效摘要"],
    subshotRows, [14, 9, 10, 8, 12, 22, 22, 34, 20, 30, 22, 18, 38, 32], "SubshotsTable");

  const referenceRows = references.map((item) => [
    text(item.reference_id), text(item.type), text(item.subject), text(item.file_path), text(item.applies_to),
    text(item.purpose), text(item.locked_attributes), text(item.allowed_changes), numberOrBlank(item.priority),
    text(item.status), text(item.note),
  ]);
  writeTable(workbook, "参考图清单",
    ["参考图ID", "类型", "对象名称", "文件路径", "适用镜号/子镜号", "参考用途", "必须保持", "允许变化", "优先级", "匹配状态", "备注"],
    referenceRows, [12, 16, 18, 38, 20, 24, 32, 26, 10, 14, 28], "ReferencesTable");

  const keyframeRows = keyframes.map((item) => [
    text(item.subshot_id), text(item.keyframe_id), numberOrBlank(item.sequence), text(item.time_position),
    text(item.purpose), text(item.shot_camera), text(item.visible_state), text(item.reference_ids),
    text(item.continuity_locks), text(item.allowed_changes), text(item.prompt), text(item.negative_prompt),
    text(item.image_path), text(item.qa_status), text(item.modification_notes),
  ]);
  const keyframeSheet = writeTable(workbook, "关键帧规划",
    ["子镜号", "关键帧编号", "顺序", "时间位置", "关键帧用途", "景别/机位", "画面状态", "参考图ID", "连续性锁定", "允许变化", "完整Prompt", "负面Prompt", "图片路径", "QA状态", "修改备注"],
    keyframeRows, [10, 14, 8, 12, 14, 20, 38, 18, 34, 26, 70, 55, 38, 14, 30], "KeyframesTable");
  if (keyframes.length > 0) {
    keyframeSheet.getRange(`E2:E${keyframes.length + 1}`).dataValidation = { rule: { type: "list", values: ["单帧场景", "首帧", "中间状态", "终帧", "转场衔接帧"] } };
    keyframeSheet.getRange(`N2:N${keyframes.length + 1}`).dataValidation = { rule: { type: "list", values: ["未检查", "通过", "需轻微修改", "需重新生成", "缺少参考图"] } };
  }

  const resultRows = keyframes.map((item) => [
    text(item.keyframe_id), text(item.image_path), text(item.image_path) ? "已生成" : "未生成",
    text(item.qa_status) || "未检查", "", numberOrBlank(item.version) || 1, text(item.updated_at), text(item.modification_notes),
  ]);
  const resultSheet = writeTable(workbook, "生成结果",
    ["关键帧编号", "图片路径", "生成状态", "QA状态", "QA问题", "版本", "更新时间", "修改备注"],
    resultRows, [14, 42, 14, 14, 42, 9, 24, 34], "GenerationResultsTable");
  if (keyframes.length > 0) {
    resultSheet.getRange(`C2:C${keyframes.length + 1}`).dataValidation = { rule: { type: "list", values: ["未生成", "生成中", "已生成", "生成失败"] } };
    resultSheet.getRange(`D2:D${keyframes.length + 1}`).dataValidation = { rule: { type: "list", values: ["未检查", "通过", "需轻微修改", "需重新生成", "缺少参考图"] } };
    resultSheet.getRange(`G2:G${keyframes.length + 1}`).format.numberFormat = "yyyy-mm-dd hh:mm:ss";
    const qaRange = resultSheet.getRange(`D2:D${keyframes.length + 1}`);
    qaRange.conditionalFormats.add("containsText", { text: "通过", format: { fill: "#E2F0D9", font: { color: "#385723" } } });
    qaRange.conditionalFormats.add("containsText", { text: "需轻微修改", format: { fill: "#FFF2CC", font: { color: "#7F6000" } } });
    qaRange.conditionalFormats.add("containsText", { text: "需重新生成", format: { fill: "#FCE4D6", font: { color: "#C00000" } } });
    qaRange.conditionalFormats.add("containsText", { text: "缺少参考图", format: { fill: "#EDEDED", font: { color: "#595959" } } });
  }

  const keyframesBySubshot = new Map();
  for (const frame of keyframes) {
    const id = text(frame.subshot_id);
    if (!keyframesBySubshot.has(id)) keyframesBySubshot.set(id, []);
    keyframesBySubshot.get(id).push(frame);
  }
  const handoffRows = subshots.map((item) => {
    const frames = (keyframesBySubshot.get(text(item.subshot_id)) || []).sort((a, b) => numberOrBlank(a.sequence) - numberOrBlank(b.sequence));
    const start = frameRole(frames, "首帧") || frames[0];
    const middle = frameRole(frames, "中间状态") || (frames.length === 3 ? frames[1] : null);
    const end = frameRole(frames, "终帧") || (frames.length > 1 ? frames[frames.length - 1] : null);
    return [
      `CLIP-${text(item.subshot_id)}`, text(item.subshot_id), numberOrBlank(item.suggested_duration_seconds),
      text(start?.image_path), text(middle?.image_path), text(end?.image_path), text(item.camera),
      text(item.motion_summary), text(item.effects_summary), text(item.continuity_group),
      start?.image_path && (frames.length === 1 || end?.image_path) ? "可交接" : "待生成关键帧",
    ];
  });
  writeTable(workbook, "视频片段交接",
    ["片段ID", "子镜号", "建议时长秒", "首帧路径", "中间帧路径", "终帧路径", "运镜", "人物/物体动作摘要", "特效摘要", "连续性组", "交接状态"],
    handoffRows, [16, 10, 12, 38, 38, 38, 22, 42, 34, 22, 16], "VideoHandoffTable");

  const formulaErrors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: "formula error scan",
  });
  if (formulaErrors.ndjson?.trim()) console.warn(formulaErrors.ndjson);

  if (args["preview-dir"]) await renderPreviews(workbook, path.resolve(args["preview-dir"]));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  console.log(JSON.stringify({
    output: outputPath,
    original_shots: source.shots.length,
    subshots: subshots.length,
    keyframes: keyframes.length,
    references: references.length,
    warnings: warnings.length,
    previews: args["preview-dir"] ? path.resolve(args["preview-dir"]) : null,
  }));
}

main().catch((error) => {
  console.error(`build-keyframe-workbook: ${error.message}`);
  process.exit(1);
});
