#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const FIELD_ALIASES = {
  shot_number: ["镜号", "镜头号", "镜头编号", "镜头", "shot", "shotno", "shotnumber"],
  duration: ["时长", "时间", "时间段", "duration", "timecode"],
  camera: ["景别/运镜", "景别运镜", "景别", "运镜", "camera", "shot/camera"],
  visual_content: ["画面内容", "画面", "场景内容", "视觉内容", "visualcontent", "description"],
  narration: ["旁白", "旁白广告词", "广告词", "narration", "voiceover", "vo"],
  subtitle_effects: ["字幕/特效", "字幕特效", "字幕", "特效", "subtitle/effects", "effects"],
  production_notes: ["拍摄备注", "制作备注", "备注", "productionnotes", "notes"],
};

function usage(exitCode = 0) {
  const text = `Usage:
  extract-storyboard.mjs --input <script.xlsx|csv|tsv> --output <storyboard.json> [--sheet <name>]

Output schema:
  {
    schema_version, source, header, chapters, shots, warnings
  }

Required source columns: 镜号, 画面内容
Recognized optional columns: 时长, 景别/运镜, 旁白, 字幕/特效, 拍摄备注`;
  console[exitCode === 0 ? "log" : "error"](text);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") usage(0);
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  if (!args.input || !args.output) usage(1);
  return args;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .trim();
}

function normalizeHeader(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[（）()【】\[\]：:·•，,。.!！?？“”"'`]/g, "")
    .replace(/[\s_\-—–]+/g, "")
    .replace(/\+/g, "plus");
}

function identifyField(value) {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeHeader(alias);
      if (normalized === normalizedAlias || normalized.startsWith(normalizedAlias)) return field;
    }
  }
  return null;
}

function findHeader(values) {
  let best = null;
  const limit = Math.min(values.length, 30);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const mapping = {};
    const labels = {};
    for (let colIndex = 0; colIndex < (values[rowIndex] || []).length; colIndex += 1) {
      const field = identifyField(values[rowIndex][colIndex]);
      if (field && mapping[field] === undefined) {
        mapping[field] = colIndex;
        labels[field] = cleanText(values[rowIndex][colIndex]);
      }
    }
    const required = Number(mapping.shot_number !== undefined) + Number(mapping.visual_content !== undefined);
    const optional = Object.keys(mapping).length - required;
    const score = required * 100 + optional * 10 - rowIndex;
    if (required === 2 && (!best || score > best.score)) {
      best = { rowIndex, mapping, labels, score };
    }
  }
  return best;
}

function formatSeconds(total) {
  if (!Number.isFinite(total) || total < 0) return "";
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const two = (number) => String(number).padStart(2, "0");
  return hours > 0 ? `${two(hours)}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

function parseTimeToken(token) {
  const text = cleanText(token).replace(/[秒sS]$/g, "");
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (!/^\d+(?::\d+(?:\.\d+)?){1,2}$/.test(text)) return null;
  const parts = text.split(":").map(Number);
  if (parts.some((value) => !Number.isFinite(value) || value < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function normalizeDuration(rawValue) {
  const raw = cleanText(rawValue);
  const warnings = [];
  if (!raw) return { raw, normalized: "", start_seconds: null, end_seconds: null, duration_seconds: null, warnings };

  const normalizedDash = raw.replace(/[—–~～至]/g, "-");
  const rangeMatch = normalizedDash.match(/(\d+(?::\d+(?:\.\d+)?){1,2})\s*-\s*(\d+(?::\d+(?:\.\d+)?){1,2})/);
  if (rangeMatch) {
    const start = parseTimeToken(rangeMatch[1]);
    const end = parseTimeToken(rangeMatch[2]);
    if (start !== null && end !== null) {
      if (end < start) warnings.push("结束时间早于开始时间");
      const duration = end >= start ? end - start : null;
      const normalized = `${formatSeconds(start)}-${formatSeconds(end)}`;
      if (rangeMatch[1] !== formatSeconds(start) || rangeMatch[2] !== formatSeconds(end)) {
        warnings.push(`时间码已规范化为 ${normalized}`);
      }
      return { raw, normalized, start_seconds: start, end_seconds: end, duration_seconds: duration, warnings };
    }
  }

  const secondsMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:秒|s)/i);
  if (secondsMatch) {
    const duration = Number(secondsMatch[1]);
    return { raw, normalized: formatSeconds(duration), start_seconds: null, end_seconds: null, duration_seconds: duration, warnings };
  }

  const token = parseTimeToken(raw);
  if (token !== null) {
    return { raw, normalized: formatSeconds(token), start_seconds: null, end_seconds: null, duration_seconds: token, warnings };
  }

  warnings.push("无法解析时长");
  return { raw, normalized: raw, start_seconds: null, end_seconds: null, duration_seconds: null, warnings };
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
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

async function loadSheets(inputPath) {
  const extension = path.extname(inputPath).toLowerCase();
  if (extension === ".csv" || extension === ".tsv") {
    const text = await fs.readFile(inputPath, "utf8");
    const values = parseDelimited(text.replace(/^\uFEFF/, ""), extension === ".tsv" ? "\t" : ",");
    return [{ name: path.basename(inputPath, extension), values }];
  }
  if (extension !== ".xlsx") throw new Error(`Unsupported input format: ${extension || "unknown"}. Use .xlsx, .csv, or .tsv.`);
  const { FileBlob, SpreadsheetFile } = await loadArtifactTool();
  const blob = await FileBlob.load(inputPath);
  const workbook = await SpreadsheetFile.importXlsx(blob);
  return workbook.worksheets.items.map((sheet) => ({
    name: sheet.name,
    values: sheet.getUsedRange(true)?.values || [],
  }));
}

function rowText(row) {
  return (row || []).map(cleanText).filter(Boolean).join(" ");
}

function isChapterRow(row, mapping) {
  const shotText = cleanText(row?.[mapping.shot_number]);
  const visualText = cleanText(row?.[mapping.visual_content]);
  const combined = rowText(row);
  const nonEmptyCount = (row || []).map(cleanText).filter(Boolean).length;
  return /篇章|章节|chapter/i.test(shotText) || (nonEmptyCount <= 2 && /篇章|章节|chapter/i.test(combined) && !visualText);
}

function makeStableSourceId(rowNumber) {
  return `SRC-R${String(rowNumber).padStart(4, "0")}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const sheets = await loadSheets(inputPath);
  if (sheets.length === 0) throw new Error("The input workbook has no worksheets.");

  const candidates = sheets.map((sheet) => ({ ...sheet, header: findHeader(sheet.values) }));
  let selected;
  if (args.sheet) {
    selected = candidates.find((candidate) => candidate.name === args.sheet);
    if (!selected) throw new Error(`Worksheet not found: ${args.sheet}`);
    if (!selected.header) throw new Error(`Worksheet '${args.sheet}' does not contain recognizable 镜号 and 画面内容 headers.`);
  } else {
    selected = candidates.filter((candidate) => candidate.header).sort((a, b) => b.header.score - a.header.score)[0];
    if (!selected) {
      throw new Error(`No worksheet contains recognizable 镜号 and 画面内容 headers. Sheets: ${sheets.map((sheet) => sheet.name).join(", ")}`);
    }
  }

  const { rowIndex: headerRowIndex, mapping, labels } = selected.header;
  const warnings = [];
  const shots = [];
  const chapters = [];
  let currentChapter = "";
  const duplicateCounts = new Map();

  for (let rowIndex = headerRowIndex + 1; rowIndex < selected.values.length; rowIndex += 1) {
    const row = selected.values[rowIndex] || [];
    if (row.every((cell) => !cleanText(cell))) continue;
    const sourceRow = rowIndex + 1;

    if (isChapterRow(row, mapping)) {
      currentChapter = rowText(row);
      chapters.push({ source_row: sourceRow, title: currentChapter });
      continue;
    }

    const shotNumber = cleanText(row[mapping.shot_number]);
    const visualContent = cleanText(row[mapping.visual_content]);
    if (!shotNumber || !visualContent) {
      warnings.push({
        source_row: sourceRow,
        code: !shotNumber ? "MISSING_SHOT_NUMBER" : "MISSING_VISUAL_CONTENT",
        message: !shotNumber ? "画面内容存在但镜号为空，已跳过" : "镜号存在但画面内容为空，已跳过",
        row_text: rowText(row),
      });
      continue;
    }

    const duplicateIndex = (duplicateCounts.get(shotNumber) || 0) + 1;
    duplicateCounts.set(shotNumber, duplicateIndex);
    const duration = normalizeDuration(mapping.duration === undefined ? "" : row[mapping.duration]);
    const shotWarnings = [...duration.warnings];
    if (duplicateIndex > 1) shotWarnings.push(`镜号 ${shotNumber} 重复出现，这是第 ${duplicateIndex} 次`);

    shots.push({
      source_id: makeStableSourceId(sourceRow),
      source_row: sourceRow,
      original_shot_number: shotNumber,
      duplicate_index: duplicateIndex,
      chapter: currentChapter,
      duration_raw: duration.raw,
      normalized_time: duration.normalized,
      start_seconds: duration.start_seconds,
      end_seconds: duration.end_seconds,
      duration_seconds: duration.duration_seconds,
      camera: mapping.camera === undefined ? "" : cleanText(row[mapping.camera]),
      visual_content: visualContent,
      narration: mapping.narration === undefined ? "" : cleanText(row[mapping.narration]),
      subtitle_effects: mapping.subtitle_effects === undefined ? "" : cleanText(row[mapping.subtitle_effects]),
      production_notes: mapping.production_notes === undefined ? "" : cleanText(row[mapping.production_notes]),
      warnings: shotWarnings,
    });
  }

  if (shots.length === 0) throw new Error(`Worksheet '${selected.name}' contains headers but no valid shot rows.`);
  for (const [shotNumber, count] of duplicateCounts.entries()) {
    if (count > 1) warnings.push({ code: "DUPLICATE_SHOT_NUMBER", message: `镜号 ${shotNumber} 共出现 ${count} 次` });
  }

  const payload = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source: {
      input_path: inputPath,
      file_name: path.basename(inputPath),
      sheet_name: selected.name,
      header_row: headerRowIndex + 1,
      used_row_count: selected.values.length,
      detected_shot_count: shots.length,
    },
    header: {
      fields: Object.fromEntries(Object.entries(mapping).map(([field, columnIndex]) => [field, {
        column_number: columnIndex + 1,
        source_label: labels[field] || "",
      }])),
    },
    chapters,
    shots,
    warnings,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    output: outputPath,
    sheet: selected.name,
    shots: shots.length,
    chapters: chapters.length,
    warnings: warnings.length + shots.reduce((sum, shot) => sum + shot.warnings.length, 0),
  }));
}

main().catch((error) => {
  console.error(`extract-storyboard: ${error.message}`);
  process.exit(1);
});
