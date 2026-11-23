import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import postcss from "postcss";
import ts from "typescript";

const css = postcss.parse(fs.readFileSync("src/styles/themes.css", "utf8"));
const accents = ["emerald", "blue", "violet", "teal", "amber"];
function tokens(mode, accent) {
  const values = {};
  css.walkRules(rule => {
    if (rule.selector === ":root" || rule.selector === `:root[data-accent="${accent}"]` || (mode === "dark" && rule.selector === "html.dark")) {
      rule.walkDecls(declaration => { if (declaration.prop.startsWith("--")) values[declaration.prop] = declaration.value; });
    }
  });
  const resolve = (key, seen = []) => {
    assert(!seen.includes(key), `Circular token: ${key}`);
    const value = values[key];
    assert(value, `Missing token: ${key}`);
    return value.replace(/var\((--[\w-]+)\)/g, (_, next) => resolve(next, [...seen, key]));
  };
  return resolve;
}
function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); }
for (const mode of ["light", "dark"]) for (const accent of accents) {
  const get = tokens(mode, accent);
  for (const [text, surface] of [["--foreground", "--background"], ["--foreground", "--card"], ["--muted-foreground", "--card"], ["--primary-foreground", "--primary"], ["--accent-text", "--card"], ["--statistic-foreground", "--card"], ["--sidebar-text", "--sidebar-bg"], ["--sidebar-text-muted", "--sidebar-bg"]]) {
    assert(contrast(get(text), get(surface)) >= 4.5, `${mode}/${accent}: ${text} on ${surface} fails contrast`);
  }
  for (const key of ["--popover", "--sidebar-bg", "--chart-1", "--ring"]) assert(/^#[a-f\d]{6}$/i.test(get(key)), `Invalid ${key}`);
}
const emeraldLight = tokens("light", "emerald");
const emeraldDark = tokens("dark", "emerald");
for (const [key, expected] of [["--brand", "#10b981"], ["--primary", "#047857"], ["--primary-hover", "#059669"], ["--accent-subtle", "#d1fae5"], ["--background", "#f0fdf4"], ["--card", "#ffffff"], ["--statistic-foreground", "#1f2937"]]) {
  assert.equal(emeraldLight(key), expected, `Emerald palette mismatch: ${key}`);
}
assert(contrast(emeraldLight("--sidebar-active-text"), emeraldLight("--sidebar-active-bg")) >= 4.5);
assert.equal(emeraldDark("--brand"), "#10b981");
assert(new Set([emeraldLight("--success"), emeraldLight("--warning"), emeraldLight("--destructive")]).size === 3);
console.log(`Requested emerald hover with white text: ${contrast(emeraldLight("--primary-foreground"), emeraldLight("--primary-hover")).toFixed(2)}:1 (below 4.5:1 for small text).`);
const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
assert(layout.includes('__html: appearanceInitializationScript'));
const compileModule = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const configModule = { exports: {} };
vm.runInNewContext(compileModule(fs.readFileSync('src/theme/config.ts', 'utf8')), configModule);
const initializationModule = { exports: {}, require: () => configModule.exports };
vm.runInNewContext(compileModule(fs.readFileSync('src/theme/initialize.ts', 'utf8')), initializationModule);
const script = initializationModule.exports.appearanceInitializationScript;
for (const theme of ["light", "dark", "system"]) for (const accent of accents) for (const deviceDark of [false, true]) {
  const classes = new Set();
  const document = { documentElement: { dataset: {}, style: {}, classList: { add: value => classes.add(value), remove: value => classes.delete(value), toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) } } };
  const saved = { theme, "app-accent": accent };
  const context = { document, localStorage: { getItem: key => saved[key] ?? null }, window: { matchMedia: () => ({ matches: deviceDark }) }, console };
  vm.runInNewContext(script, context);
  const dark = theme === "dark" || (theme === "system" && deviceDark);
  assert.equal(classes.has("dark"), dark);
  assert.equal(document.documentElement.style.colorScheme, dark ? "dark" : "light");
  assert.equal(document.documentElement.dataset.accent, accent);
  // Refresh re-runs the boot script without losing either independent setting.
  vm.runInNewContext(script, context);
  assert.equal(document.documentElement.dataset.accent, accent);
}
assert(fs.readFileSync("src/app/Providers.tsx", "utf8").includes("enableSystem disableTransitionOnChange"));
console.log("Passed: 10 palette/contrast combinations and 30 saved-theme/device/refresh scenarios.");
