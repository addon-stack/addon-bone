import {readFile} from "node:fs/promises";
import path from "node:path";
import coverage from "istanbul-lib-coverage";
import report from "istanbul-lib-report";
import reports from "istanbul-reports";

const files = process.argv.slice(2);
if (files.length < 2) throw new Error("Pass the unit and build coverage-final.json files");
const map = coverage.createCoverageMap({});
for (const file of files) map.merge(JSON.parse(await readFile(file, "utf8")));
const context = report.createContext({dir: path.resolve("coverage/merged"), coverageMap: map});
for (const format of ["json", "lcov", "text-summary"]) reports.create(format).execute(context);
