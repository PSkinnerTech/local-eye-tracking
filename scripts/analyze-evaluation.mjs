import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  analyzeEvaluationPayloads,
  formatEvaluationAnalysis,
  validateEvaluationPayload
} from "./lib/evaluation-analysis.mjs";

const usage = "Usage: npm run analyze:evaluation -- <export.json> [more-export.json ...]";

export async function run(args, io = process) {
  if (args.length === 0) {
    io.stderr.write(`${usage}\n`);
    return 1;
  }

  try {
    const payloads = [];

    for (const filePath of args) {
      const payload = await readEvaluationJson(filePath);
      payloads.push(validateEvaluationPayload(payload, filePath));
    }

    const analysis = analyzeEvaluationPayloads(payloads, args.length);
    io.stdout.write(formatEvaluationAnalysis(analysis));
    return 0;
  } catch (error) {
    io.stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}

async function readEvaluationJson(filePath) {
  let contents;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`${filePath} must be valid JSON: ${error.message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
