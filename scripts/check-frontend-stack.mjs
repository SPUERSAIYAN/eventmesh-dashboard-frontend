import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const forbiddenPackages = ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "antd", "@ant-design/icons", "echarts", "echarts-for-react", "@vitejs/plugin-react"];
const declared = { ...manifest.dependencies, ...manifest.devDependencies };
const errors = forbiddenPackages.filter((name) => declared[name]).map((name) => `forbidden package: ${name}`);

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else if (entry.name.endsWith(".tsx")) errors.push(`forbidden TSX source: ${path.relative(root, absolute)}`);
    else if (/\.(ts|vue|css)$/.test(entry.name)) {
      const source = readFileSync(absolute, "utf8");
      for (const name of forbiddenPackages) if (new RegExp(`(?:from\\s+|import\\s*\\()["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[/"'])`).test(source)) errors.push(`forbidden import ${name}: ${path.relative(root, absolute)}`);
      if (/\.ant-|--ant-/.test(source)) errors.push(`forbidden Ant Design selector: ${path.relative(root, absolute)}`);
    }
  }
}
visit(path.join(root, "src"));
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Frontend stack boundary verified: Vue + TDesign + AntV only.");
