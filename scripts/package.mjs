// Build the Komari theme zip: preview.png + komari-theme.json + dist/
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const output = `komari-theme-tasogare-latency-${version}-komari.zip`;

for (const file of ["preview.png", "komari-theme.json", "dist/index.html"]) {
  if (!existsSync(file)) {
    console.error(`missing ${file} — run \`npm run build\` first`);
    process.exit(1);
  }
}

const script = `
import zipfile, os
with zipfile.ZipFile('${output}','w',zipfile.ZIP_DEFLATED) as z:
    z.write('preview.png')
    z.write('komari-theme.json')
    for root,_,files in os.walk('dist'):
        for f in files:
            p=os.path.join(root,f); z.write(p, p.replace(os.sep, '/'))
print('created ${output}')`;

const candidates = process.platform === "win32"
  ? [["python", []], ["py", ["-3"]], ["python3", []]]
  : [["python3", []], ["python", []]];

for (const [command, args] of candidates) {
  const result = spawnSync(command, [...args, "-c", script], { stdio: "inherit" });
  if (result.error?.code === "ENOENT") continue;
  process.exit(result.status ?? 1);
}

console.error("Python 3 is required to create the theme package.");
process.exit(1);
