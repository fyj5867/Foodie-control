/**
 * Checks the arithmetic behind "shrink the photo before sending it".
 *
 * The bug this exists for: photos were sent at full resolution. An iPhone's
 * 12MP picture is 3-5MB and base64 adds a third on top, which is past
 * Anthropic's 5MB-per-image limit outright and a very long upload on mobile
 * data — the user reported roughly four failures in five.
 *
 * The canvas work has to happen in a browser, so what is testable here is the
 * part that decides the size and the part that decides whether to give up.
 *
 * Run from source/:  node tools/test-photo.mjs
 */
import {
  fitWithin,
  base64Bytes,
  tooBigMessage,
  VISION_MAX_DIM,
  REPORT_MAX_DIM,
  THUMB_MAX_DIM,
  MAX_UPLOAD_BYTES,
} from "../lib/photo.js";

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed += 1;
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`);
}

function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? "\n    " + detail : ""}`);
}

/* --- a real iPhone photo ---
 * 12MP is 4032x3024. Landscape and portrait have to come out the same size,
 * which is the bug the old inline arithmetic was one typo away from. */
check("a landscape 12MP photo", fitWithin(4032, 3024, 1280), { width: 1280, height: 960 });
check("and the same photo held upright", fitWithin(3024, 4032, 1280), { width: 960, height: 1280 });
check("a square one", fitWithin(3000, 3000, 1280), { width: 1280, height: 1280 });

/* Enlarging is pointless: the extra pixels are invented, the model sees no more
 * than before, and the upload grows. */
check("something already small is left alone", fitWithin(600, 400, 1280), { width: 600, height: 400 });
check("exactly at the cap is left alone", fitWithin(1280, 720, 1280), { width: 1280, height: 720 });

/* A canvas of zero width throws, so a panorama must not round away to nothing. */
check("an extreme panorama keeps at least one pixel", fitWithin(20000, 3, 1280), { width: 1280, height: 1 });

check("nonsense in, nothing out", fitWithin(0, 100, 1280), null);
check("and negatives too", fitWithin(-5, 100, 1280), null);
check("and text", fitWithin("abc", 100, 1280), null);
check("no cap means no change", fitWithin(4032, 3024, 0), { width: 4032, height: 3024 });

/* --- how big is that in bytes ---
 * base64 is 4 characters per 3 bytes, and the padding is not data. */
check("three bytes are four characters", base64Bytes("YWJj"), 3);
check("one byte with two pads", base64Bytes("YQ=="), 1);
check("two bytes with one pad", base64Bytes("YWI="), 2);
check("nothing is nothing", base64Bytes(""), 0);
check("and so is rubbish", base64Bytes(null), 0);

/* --- the refusal, and what it says ---
 * The old failure mode said 「辨識服務暫時無法使用」, which tells someone holding
 * a too-large photo nothing at all — so she retakes the same photo. */
const small = "A".repeat(1000);
check("an ordinary photo says nothing", tooBigMessage(small), null);
const huge = "A".repeat(Math.ceil((MAX_UPLOAD_BYTES + 1024 * 1024) * 4 / 3));
const message = tooBigMessage(huge);
ok("an oversized one is refused", Boolean(message), String(message));
ok("and the message says how big it is", /\d+\.\d+MB/.test(message), message);
ok("and what to do instead", message.includes("手動輸入"), message);
ok("the label is used, so 報告 does not read as 食物", tooBigMessage(huge, "報告照片").includes("報告照片"));

/* --- the caps themselves ---
 * Reading printed digits off a report needs more pixels than recognising a
 * bowl of rice; a stored thumbnail needs far fewer than either. */
ok("a report keeps more detail than a meal", REPORT_MAX_DIM > VISION_MAX_DIM, `${REPORT_MAX_DIM} / ${VISION_MAX_DIM}`);
ok("and a thumbnail far less", THUMB_MAX_DIM < VISION_MAX_DIM, `${THUMB_MAX_DIM} / ${VISION_MAX_DIM}`);
/* Anthropic's own limit is 5MB per image; sitting right on it fails with an
 * error that does not mention size. */
ok("the upload cap leaves room under the 5MB limit", MAX_UPLOAD_BYTES < 5 * 1024 * 1024, String(MAX_UPLOAD_BYTES));
ok("but is not so small it rejects ordinary photos", MAX_UPLOAD_BYTES > 2 * 1024 * 1024, String(MAX_UPLOAD_BYTES));

/* --- the whole point, in numbers ---
 * A 12MP JPEG is around 3.5MB. At quality 0.82 and 1280px, real photos land
 * near 200KB; even a pessimistic 3 bytes per pixel of raw data would be well
 * inside the cap once encoded. This asserts the shape of the win rather than a
 * specific encoder's output. */
const before = 4032 * 3024;
const after = 1280 * 960;
ok("shrinking removes about 90% of the pixels", after / before < 0.11, `${(after / before).toFixed(3)}`);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
