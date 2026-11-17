// Copies METHOD from netlify/lib/method.mjs into src/wordmbti_crew/method.py (the Python agents share the same judging rules).
//   node eval/sync-method.mjs          rewrite the METHOD line in method.py
//   node eval/sync-method.mjs --check  exit 1 if method.py is out of date
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { METHOD } from "../netlify/lib/method.mjs";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/wordmbti_crew/method.py");
const src = fs.readFileSync(file, "utf8");
const line = "METHOD = " + JSON.stringify(METHOD);       // a JSON string is also a valid Python string literal
const next = src.replace(/^METHOD = ".*"$/m, () => line);
if (!/^METHOD = ".*"$/m.test(src)) throw new Error("METHOD line not found in method.py");
if (process.argv.includes("--check")) { if (next !== src) { console.error("method.py is out of date: run node eval/sync-method.mjs"); process.exit(1); } console.log("method.py is up to date"); }
else { fs.writeFileSync(file, next); console.log(next === src ? "method.py already up to date" : "method.py updated"); }
