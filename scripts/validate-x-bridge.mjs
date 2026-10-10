import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const extensionRoot = path.join(root, "x-extension");
const require = createRequire(import.meta.url);
const manifest = JSON.parse(
  readFileSync(path.join(extensionRoot, "manifest.json"), "utf8")
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function jsFiles(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...jsFiles(fullPath));
    } else if (name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}


const shared = require(path.join(extensionRoot, "src", "shared.js"));
const bracketedLocalPath = shared.parseLocalImagePath(
  "<Publisher Acceptance/image-case/local-test.png>"
);
assert(
  bracketedLocalPath.ok &&
    JSON.stringify(bracketedLocalPath.parts) ===
      JSON.stringify(["Publisher Acceptance", "image-case", "local-test.png"]),
  "X Bridge must strip Markdown angle brackets before resolving local image paths"
);

// Regression for drafts with more than three embedded images.
const fiveImages = Array.from({ length: 5 }, (_, i) => ({
  type: "image", source: `images/image-${i + 1}.png`, alt: `image ${i + 1}`
}));
const fiveResults = new Map(fiveImages.map((segment, i) => [
  segment,
  { ok: true, base64: "AA==", mime: "image/png", fileName: `image-${i + 1}.png` }
]));
const fiveImagePlan = shared.buildPastePlan(fiveImages, fiveResults, new Map());
assert(
  fiveImagePlan.plan.filter((entry) => entry.op.type === "image").length === 5,
  "X Bridge must schedule all five images, not only the first three"
);
assert(
  fiveImagePlan.plan.some((entry) => /_IMAGE_4__$/.test(entry.marker)),
  "X Bridge must include the fifth image placeholder"
);

assert(manifest.manifest_version === 3, "X Bridge must use Manifest V3");
assert(
  manifest.permissions?.includes("clipboardRead"),
  "X Bridge must have clipboardRead permission"
);
assert(
  manifest.permissions?.includes("sidePanel"),
  "X Bridge must have sidePanel permission"
);
assert(
  manifest.permissions?.includes("offscreen"),
  "X Bridge must have offscreen permission for automatic clipboard handoff"
);
assert(
  readFileSync(path.join(extensionRoot, "LICENSE.xposter"), "utf8")
    .includes("MIT License"),
  "Bundled xPoster MIT license is missing"
);
assert(
  readFileSync(path.join(extensionRoot, "UPSTREAM.md"), "utf8")
    .includes("github.com/nevertoday/xposter"),
  "Pinned xPoster upstream attribution is missing"
);

const sidepanel = readFileSync(
  path.join(extensionRoot, "sidepanel.js"),
  "utf8"
);
const background = readFileSync(
  path.join(extensionRoot, "src", "background.js"),
  "utf8"
);
const mainWorld = readFileSync(
  path.join(extensionRoot, "src", "main-world.js"),
  "utf8"
);
const content = readFileSync(
  path.join(extensionRoot, "src", "content.js"),
  "utf8"
);

const settleStart = mainWorld.indexOf("  async function settleImportMarkers(");
const settleEnd = mainWorld.indexOf(
  "\n  async function settleUploadedImageAtMarker(",
  settleStart
);
assert(settleStart >= 0 && settleEnd > settleStart,
  "X Bridge stable marker cleanup function is missing");
const makeSettleImportMarkers = new Function(
  "Date", "findDraftStateNode", "countMarkerTokens",
  "cleanupMarkers", "throwIfCancelled", "sleep",
  mainWorld.slice(settleStart, settleEnd) +
    "\nreturn settleImportMarkers;"
);

let fakeNow = 0;
let fakeMarkers = 1;
let reappeared = false;
const settleMarkers = makeSettleImportMarkers(
  { now: () => fakeNow },
  () => ({ current: true }),
  () => fakeMarkers,
  () => { fakeMarkers = 0; return 1; },
  () => {},
  async (ms) => {
    fakeNow += ms;
    if (!reappeared && fakeNow >= 3000) {
      fakeMarkers = 1; // X's autosave rehydrates an earlier Draft.js state.
      reappeared = true;
    }
  }
);
const settled = await settleMarkers("__XPOSTER_test_");
assert(reappeared && settled.cleaned === 2 && settled.remaining === 0,
  "X Bridge must clean markers that return after the initial render");
assert(fakeNow >= 6000,
  "X Bridge must wait past the autosave debounce before declaring success");

fakeNow = 0;
const unresolved = makeSettleImportMarkers(
  { now: () => fakeNow },
  () => ({ current: true }),
  () => 1,
  () => 0,
  () => {},
  async (ms) => { fakeNow += ms; }
);
const unresolvedResult = await unresolved("__XPOSTER_test_");
assert(unresolvedResult.remaining === 1 && fakeNow >= 12000,
  "X Bridge must report a non-removable marker as an incomplete import");

const markerHelpersStart = mainWorld.indexOf("  function markerTokenPattern(");
const markerHelpersEnd = mainWorld.indexOf(
  "\n  function relocateImages(",
  markerHelpersStart
);
assert(markerHelpersStart >= 0 && markerHelpersEnd > markerHelpersStart,
  "X Bridge marker residue cleanup helpers are missing");
const stripMarkerResidues = new Function(
  mainWorld.slice(markerHelpersStart, markerHelpersEnd) +
    "\nreturn stripMarkerResidues;"
)();
for (const raw of [
  "__XPOSTER_wigf9_IMAGE_4__",
  "__XPOSTER_wigf9_IMAGE_4",
  "__XPOSTER_",
  "___XPOSTER_wigf9_IMAGE_4__"
]) {
  assert(!stripMarkerResidues(raw, "__XPOSTER_wigf9_").includes("XPOSTER_"),
    "X Bridge must strip complete and truncated image markers");
}
assert(
  mainWorld.includes("summary.remainingMarkers = settledMarkers.remaining") &&
    mainWorld.includes("summary.imgFail > 0") &&
    mainWorld.includes("summary.imgPending > 0") &&
    mainWorld.includes("summary.mediaEntitiesPresent < summary.mediaEntitiesExpected"),
  "X Bridge must not finish when images fail, remain pending, or leave placeholders"
);
assert(
  content.includes("const fullyImported =") &&
    content.includes("return { ok: false, error: message, summary }"),
  "X content bridge must not report a partial import as complete"
);
assert(
  background.includes("remainingMarkers || 0") &&
    background.includes("main?.imgFail || 0"),
  "X auto-handoff must propagate incomplete media status"
);
assert(
  mainWorld.includes("async function waitForStableMediaEntities(expected") &&
    mainWorld.includes("const beforeChange = await waitForStableMediaEntities(expectedMedia)") &&
    mainWorld.includes("const afterChange = await waitForStableMediaEntities(expectedMedia)") &&
    mainWorld.includes("X lost an image during marker cleanup"),
  "X Bridge must wait for stable media blocks before continuing to the next image"
);
assert(
  background.includes("verifyPersistedDraft(tab.id, expectedMedia)") &&
    background.includes("reloadXArticleAndWait(tabId)") &&
    background.includes("persistedVerified === true") &&
    content.includes('message?.type === "xposter:verify-editor"') &&
    mainWorld.includes('event.data.kind === "verify-editor"'),
  "X Bridge must re-open X draft and verify persistent media/markers before reporting success"
);
assert(
  sidepanel.includes('OBSIDIAN_PUBLISHER_X_V1\\n'),
  "Obsidian Publisher handoff prefix consumer is missing"
);
assert(
  sidepanel.includes("navigator.clipboard.readText()"),
  "X Bridge clipboard handoff reader is missing"
);
assert(
  sidepanel.includes("allowGraphqlMetadata: false"),
  "X Bridge import options must hard-disable GraphQL metadata"
);
assert(
  sidepanel.includes("setCover: false"),
  "X Bridge import options must hard-disable automated cover metadata"
);
assert(
  background.includes("chrome.tabs.onUpdated.addListener"),
  "X Bridge automatic X Articles handoff listener is missing"
);
assert(
  background.includes("chrome.tabs.onActivated.addListener"),
  "X Bridge must also handle an already-open X Articles tab becoming active"
);
assert(
  background.includes("obsidian-publisher:read-clipboard"),
  "X Bridge automatic clipboard reader request is missing"
);
assert(
  background.includes("forceNewArticle: true"),
  "X Bridge automatic handoff must create a new X Article draft"
);
assert(
  background.includes("allowGraphqlMetadata: false"),
  "Automatic X Bridge handoff must disable GraphQL metadata"
);
assert(
  background.includes("mediaFailures.length === 0"),
  "Automatic X Bridge must not report success when media import fails"
);
assert(
  readFileSync(path.join(extensionRoot, "offscreen.html"), "utf8")
    .includes("offscreen.js"),
  "X Bridge offscreen clipboard document is missing"
);
assert(
  readFileSync(path.join(extensionRoot, "offscreen.js"), "utf8")
    .includes('document.execCommand("paste")'),
  "X Bridge offscreen reader must use extension paste permission instead of focused Clipboard API"
);

const sourceText = jsFiles(extensionRoot)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

assert(
  !sourceText.includes("https://x.com/i/api/graphql/"),
  "Private X GraphQL endpoint is forbidden in X Bridge"
);
assert(
  !sourceText.includes("AAAAAAAAAAAAAAAAAAAAANRILg"),
  "Embedded X bearer token is forbidden in X Bridge"
);

for (const file of jsFiles(extensionRoot)) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

console.log(
  `X Bridge validation passed: ${manifest.name} v${manifest.version}`
);
