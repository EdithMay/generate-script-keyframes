#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const GENERATION_STATUSES = new Set(["未生成", "生成中", "已生成", "生成失败"]);
const QA_STATUSES = new Set(["未检查", "通过", "需轻微修改", "需重新生成", "缺少参考图"]);

const RESULTS_SCHEMA = `{
  "results": [{
    "keyframe_id": "3A-K1",
    "image_path": "/path/S03A-K1.png",
    "generation_status": "已生成",
    "qa_status": "通过",
    "qa_issues": "",
    "version": 1,
    "updated_at": "2026-08-19T12:00:00Z",
    "modification_note": ""
  }]
}`;

function usage(exitCode = 0) {
  const text = `Usage:
  update-generation-results.mjs --workbook <plan.xlsx> --results <results.json> --output <reviewed.xlsx> [--preview-dir <dir>]
  update-generation-results.mjs --workbook <plan.xlsx> --results <results.json> --in-place [--preview-dir <dir>]

Results JSON schema:
${RESULTS_SCHEMA}`;
  console[exitCode === 0 ? "log" : "error"](text);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") usage(0);
    if (token === "--in-place") {
      args["in-place"] = true;
      continue;
    }
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  if (!args.workbook || !args.results || (!args.output && !args["in-place"])) usage(1);
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
  return String(value).trim();
}

function normalizeResults(payload) {
  const results = Array.isArray(payload) ? payload : payload.results;
  if (!Array.isArray(results) || results.length === 0) throw new Error("Results JSON contains no result records.");
  const seen = new Set();
  return results.map((item, index) => {
    const keyframeId = text(item.keyframe_id);
    if (!keyframeId) throw new Error(`Result ${index + 1} has no keyframe_id.`);
    if (seen.has(keyframeId)) throw new Error(`Duplicate result keyframe_id: ${keyframeId}`);
    seen.add(keyframeId);
    const generationStatus = text(item.generation_status);
    const qaStatus = text(item.qa_status);
    if (generationStatus && !GENERATION_STATUSES.has(generationStatus)) throw new Error(`Invalid generation_status for ${keyframeId}: ${generationStatus}`);
    if (qaStatus && !QA_STATUSES.has(qaStatus)) throw new Error(`Invalid qa_status for ${keyframeId}: ${qaStatus}`);
    return { ...item, keyframe_id: keyframeId };
  });
}

function sheetData(sheet) {
  const usedRange = sheet.getUsedRange(true);
  if (!usedRange) throw new Error(`Worksheet '${sheet.name}' is empty.`);
  const values = usedRange.values || [];
  const headers = new Map((values[0] || []).map((value, index) => [text(value), index]));
  return { values, headers };
}

function requireColumns(sheetName, headers, names) {
  for (const name of names) {
    if (!headers.has(name)) throw new Error(`Worksheet '${sheetName}' is missing column '${name}'.`);
  }
}

function writeCell(sheet, rowIndex, columnIndex, value) {
  sheet.getCell(rowIndex, columnIndex).values = [[value === undefined || value === null ? "" : value]];
}

function writeTimestampCell(sheet, rowIndex, columnIndex, value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    writeCell(sheet, rowIndex, columnIndex, text(value));
    sheet.getCell(rowIndex, columnIndex).format.numberFormat = "@";
    return;
  }
  writeCell(sheet, rowIndex, columnIndex, parsed);
  sheet.getCell(rowIndex, columnIndex).format.numberFormat = "yyyy-mm-dd hh:mm:ss";
}

function mapRows(values, keyColumnIndex) {
  const rows = new Map();
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const key = text(values[rowIndex]?.[keyColumnIndex]);
    if (key) rows.set(key, rowIndex);
  }
  return rows;
}

function sanitizeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "_");
}

async function renderPreviews(workbook, directory) {
  await fs.mkdir(directory, { recursive: true });
  for (const sheet of workbook.worksheets.items) {
    const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(path.join(directory, `${sanitizeFileName(sheet.name)}.png`), new Uint8Array(await preview.arrayBuffer()));
  }
}

function updateSummary(summarySheet, completed, total, passed, hardFailures) {
  const { values } = sheetData(summarySheet);
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < values[rowIndex].length; columnIndex += 1) {
      if (text(values[rowIndex][columnIndex]) === "图像生成") {
        const status = completed === 0 ? "未开始" : completed < total ? `进行中 ${completed}/${total}` : hardFailures > 0 ? `已生成，${hardFailures}项需重做` : `已完成 ${completed}/${total}`;
        writeCell(summarySheet, rowIndex, columnIndex + 1, status);
      }
    }
  }

  const startRow = Math.max(values.length + 2, 12);
  summarySheet.getRangeByIndexes(startRow - 1, 0, 1, 4).values = [["生成与质检统计", "数量", "说明", "更新时间"]];
  summarySheet.getRangeByIndexes(startRow, 0, 4, 4).values = [
    ["已生成关键帧", completed, `共 ${total} 张`, new Date()],
    ["QA通过", passed, "状态为通过", ""],
    ["需重新生成", hardFailures, "含缺少参考图", ""],
    ["剩余未生成", Math.max(0, total - completed), "", ""],
  ];
  summarySheet.getRangeByIndexes(startRow - 1, 0, 1, 4).format = { fill: "#5B9BD5", font: { bold: true, color: "#FFFFFF" } };
  summarySheet.getRangeByIndexes(startRow, 0, 4, 4).format = { wrapText: true, borders: { preset: "all", style: "thin", color: "#D9E2F3" } };
  summarySheet.getCell(startRow, 3).format.numberFormat = "yyyy-mm-dd hh:mm:ss";
}

function updateHandoff(workbook) {
  const keyframeSheet = workbook.worksheets.getItem("关键帧规划");
  const handoffSheet = workbook.worksheets.getItem("视频片段交接");
  const keyframeData = sheetData(keyframeSheet);
  const handoffData = sheetData(handoffSheet);
  requireColumns("关键帧规划", keyframeData.headers, ["子镜号", "顺序", "关键帧用途", "图片路径"]);
  requireColumns("视频片段交接", handoffData.headers, ["子镜号", "首帧路径", "中间帧路径", "终帧路径", "交接状态"]);

  const grouped = new Map();
  for (let rowIndex = 1; rowIndex < keyframeData.values.length; rowIndex += 1) {
    const row = keyframeData.values[rowIndex];
    const subshotId = text(row[keyframeData.headers.get("子镜号")]);
    if (!subshotId) continue;
    if (!grouped.has(subshotId)) grouped.set(subshotId, []);
    grouped.get(subshotId).push({
      sequence: Number(row[keyframeData.headers.get("顺序")]) || rowIndex,
      purpose: text(row[keyframeData.headers.get("关键帧用途")]),
      imagePath: text(row[keyframeData.headers.get("图片路径")]),
    });
  }

  for (let rowIndex = 1; rowIndex < handoffData.values.length; rowIndex += 1) {
    const subshotId = text(handoffData.values[rowIndex]?.[handoffData.headers.get("子镜号")]);
    const frames = (grouped.get(subshotId) || []).sort((a, b) => a.sequence - b.sequence);
    if (frames.length === 0) continue;
    const start = frames.find((frame) => frame.purpose === "首帧") || frames[0];
    const middle = frames.find((frame) => frame.purpose === "中间状态") || (frames.length === 3 ? frames[1] : null);
    const end = frames.find((frame) => frame.purpose === "终帧") || (frames.length > 1 ? frames[frames.length - 1] : null);
    writeCell(handoffSheet, rowIndex, handoffData.headers.get("首帧路径"), start?.imagePath || "");
    writeCell(handoffSheet, rowIndex, handoffData.headers.get("中间帧路径"), middle?.imagePath || "");
    writeCell(handoffSheet, rowIndex, handoffData.headers.get("终帧路径"), end?.imagePath || "");
    const ready = Boolean(start?.imagePath) && (frames.length === 1 || Boolean(end?.imagePath));
    writeCell(handoffSheet, rowIndex, handoffData.headers.get("交接状态"), ready ? "可交接" : "待生成关键帧");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workbookPath = path.resolve(args.workbook);
  const resultsPath = path.resolve(args.results);
  const outputPath = args["in-place"] ? workbookPath : path.resolve(args.output);
  if (!args["in-place"] && outputPath === workbookPath) throw new Error("Refusing to overwrite the source workbook without --in-place.");

  const payload = JSON.parse(await fs.readFile(resultsPath, "utf8"));
  const results = normalizeResults(payload);
  const { FileBlob, SpreadsheetFile } = await loadArtifactTool();
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));

  const resultSheet = workbook.worksheets.getItem("生成结果");
  const planSheet = workbook.worksheets.getItem("关键帧规划");
  const resultData = sheetData(resultSheet);
  const planData = sheetData(planSheet);
  requireColumns("生成结果", resultData.headers, ["关键帧编号", "图片路径", "生成状态", "QA状态", "QA问题", "版本", "更新时间", "修改备注"]);
  requireColumns("关键帧规划", planData.headers, ["关键帧编号", "图片路径", "QA状态", "修改备注"]);

  const resultRows = mapRows(resultData.values, resultData.headers.get("关键帧编号"));
  const planRows = mapRows(planData.values, planData.headers.get("关键帧编号"));
  const now = new Date().toISOString();

  for (const result of results) {
    const resultRow = resultRows.get(result.keyframe_id);
    const planRow = planRows.get(result.keyframe_id);
    if (resultRow === undefined || planRow === undefined) throw new Error(`Unknown keyframe_id in results: ${result.keyframe_id}`);

    const currentVersion = Number(resultData.values[resultRow]?.[resultData.headers.get("版本")]) || 1;
    const imagePath = result.image_path === undefined ? text(resultData.values[resultRow]?.[resultData.headers.get("图片路径")]) : text(result.image_path);
    const generationStatus = text(result.generation_status) || (imagePath ? "已生成" : "未生成");
    const qaStatus = text(result.qa_status) || text(resultData.values[resultRow]?.[resultData.headers.get("QA状态")]) || "未检查";
    const qaIssues = result.qa_issues === undefined ? text(resultData.values[resultRow]?.[resultData.headers.get("QA问题")]) : text(result.qa_issues);
    const modificationNote = result.modification_note === undefined ? text(resultData.values[resultRow]?.[resultData.headers.get("修改备注")]) : text(result.modification_note);
    const version = result.version === undefined ? currentVersion : Number(result.version) || currentVersion;
    const updatedAt = text(result.updated_at) || now;

    writeCell(resultSheet, resultRow, resultData.headers.get("图片路径"), imagePath);
    writeCell(resultSheet, resultRow, resultData.headers.get("生成状态"), generationStatus);
    writeCell(resultSheet, resultRow, resultData.headers.get("QA状态"), qaStatus);
    writeCell(resultSheet, resultRow, resultData.headers.get("QA问题"), qaIssues);
    writeCell(resultSheet, resultRow, resultData.headers.get("版本"), version);
    writeTimestampCell(resultSheet, resultRow, resultData.headers.get("更新时间"), updatedAt);
    writeCell(resultSheet, resultRow, resultData.headers.get("修改备注"), modificationNote);

    writeCell(planSheet, planRow, planData.headers.get("图片路径"), imagePath);
    writeCell(planSheet, planRow, planData.headers.get("QA状态"), qaStatus);
    writeCell(planSheet, planRow, planData.headers.get("修改备注"), modificationNote || qaIssues);
  }

  updateHandoff(workbook);

  const refreshed = sheetData(resultSheet);
  const statusColumn = refreshed.headers.get("生成状态");
  const qaColumn = refreshed.headers.get("QA状态");
  const total = refreshed.values.length - 1;
  let completed = 0;
  let passed = 0;
  let hardFailures = 0;
  for (let rowIndex = 1; rowIndex < refreshed.values.length; rowIndex += 1) {
    const generationStatus = text(refreshed.values[rowIndex]?.[statusColumn]);
    const qaStatus = text(refreshed.values[rowIndex]?.[qaColumn]);
    if (generationStatus === "已生成") completed += 1;
    if (qaStatus === "通过") passed += 1;
    if (qaStatus === "需重新生成" || qaStatus === "缺少参考图") hardFailures += 1;
  }
  updateSummary(workbook.worksheets.getItem("项目摘要"), completed, total, passed, hardFailures);

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
  console.log(JSON.stringify({ output: outputPath, updated: results.length, completed, passed, hard_failures: hardFailures }));
}

main().catch((error) => {
  console.error(`update-generation-results: ${error.message}`);
  process.exit(1);
});
