// examples/run_ts_example.ts
import { scorePropertyGoose } from "../src/propertygoose_scoring.js";
import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(new URL("./example_input.json", import.meta.url)));
const result = scorePropertyGoose(input);
console.log(JSON.stringify(result, null, 2));
