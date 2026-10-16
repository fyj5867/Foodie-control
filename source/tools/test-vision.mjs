/**
 * Checks how a model's reply is read, and how each way of failing is named.
 *
 * This file exists because of one question the app could not answer: when a
 * photo "fails", which of these happened?
 *
 *   - the reply ran out of room and stopped mid-object,
 *   - the model answered in prose instead of JSON,
 *   - the model refused,
 *   - or nothing came back at all.
 *
 * All four used to arrive as 「辨識結果格式不正確」 or 「服務暫時無法使用」, which
 * sends someone back to retake the same photo — the one action that cannot
 * help with any of them. A static app has no logs, so a failure that does not
 * name itself on screen is a failure nobody can ever diagnose.
 *
 * Run from source/:  node tools/test-vision.mjs
 */
import { parseJsonReply, askAboutImage, FOOD_PROMPT, LAB_PROMPT, BODY_PROMPT } from "../lib/vision.js";

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

function threw(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return e;
  }
}

/* --- the ordinary cases --- */
check("plain JSON parses", parseJsonReply('{"a":1}'), { a: 1 });
check("a markdown fence is stripped", parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
check("a sentence before the JSON is stepped over", parseJsonReply('好的，結果如下：\n{"a":1}'), { a: 1 });
check("and after it", parseJsonReply('{"a":1}\n希望有幫助'), { a: 1 });

/* --- a reply that ran out of room ---
 * This is the failure the food prompt actually risks: a name, every dish, three
 * macros, a note, a reason and the tags, all in Chinese. Cut off mid-object it
 * opens a brace and never closes it — which is a different problem from a
 * malformed reply, and needs different advice. */
const cut = threw(() => parseJsonReply('{"foodName":"雞腿便當","items":[{"name":"白飯","kcal":2'));
ok("a cut-off reply throws", Boolean(cut), String(cut));
ok("and is named as truncation, not bad format", /截斷|太長/.test(cut.message), cut.message);
ok("and does not tell her to retake the photo", !/重新拍攝/.test(cut.message), cut.message);
ok("it offers the way out that does work", /手動輸入/.test(cut.message), cut.message);

/* --- a reply that was never JSON --- */
const prose = threw(() => parseJsonReply("這看起來像一份雞腿便當，大約 700 大卡。"));
ok("prose throws", Boolean(prose), String(prose));
ok("and is named as a format problem", /格式/.test(prose.message), prose.message);
/* The model's own words are carried on the error so the card can show them —
 * without this, a static app has no way whatsoever to find out what it said. */
ok("the reply itself is attached", typeof prose.reply === "string" && prose.reply.length > 0, String(prose.reply));
ok("and it is the model's actual words", prose.reply.includes("雞腿便當"), prose.reply);
ok("but is kept short enough to read aloud", prose.reply.length <= 160, String(prose.reply.length));

/* --- nothing at all --- */
ok("an empty reply throws", Boolean(threw(() => parseJsonReply(""))), "");
ok("whitespace only throws", Boolean(threw(() => parseJsonReply("   \n "))), "");
ok("a non-string throws", Boolean(threw(() => parseJsonReply(null))), "");

/* Braces inside a string value must not confuse the fallback scan. */
check("braces inside a value survive", parseJsonReply('{"note":"一份 {大} 碗"}'), { note: "一份 {大} 碗" });

/* --- what we ask the model for ---
 * The prompts are the reason the replies are long, so the sizes are worth
 * stating out loud: if one of these grows a lot, its maxTokens needs a look. */
ok("the food prompt asks for a JSON object", FOOD_PROMPT.includes("純 JSON"), FOOD_PROMPT.slice(0, 40));
ok("and names the fields it wants", FOOD_PROMPT.includes("estimatedCalories") && FOOD_PROMPT.includes("items"));
/* The model returns tag keys only — never a sentence about health. That is the
 * line the whole feature rests on, so it is asserted here as well as in
 * test-nutrition.mjs. */
ok("and forbids the model writing health advice", FOOD_PROMPT.includes("不要自己寫任何健康建議"), "FOOD_PROMPT");
ok("the report prompt asks for JSON too", LAB_PROMPT.includes("純 JSON"));
ok("and the scale prompt", BODY_PROMPT.includes("純 JSON"));
/* Transcribe, do not interpret — the same rule, stated in the prompt itself. */
ok("the scale prompt forbids commentary", /不要解讀|不要評論/.test(BODY_PROMPT), "BODY_PROMPT");


/* --- retrying a busy model ---
 * The failure that was actually happening, nine times in ten: Google answers a
 * busy free-tier model with 503 "This model is currently experiencing high
 * demand… Please try again later." The app printed that advice and then did not
 * take it. These tests pin which failures are worth a second go and which are
 * not — retrying a bad API key just makes someone wait longer to hear the same
 * thing. `fetch` is stubbed, so nothing here touches the network. */
const realFetch = globalThis.fetch;

function stubFetch(responses) {
  let i = 0;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init && init.body });
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (next.throw) throw new Error("network down");
    return {
      ok: next.status === 200,
      status: next.status,
      async json() {
        return next.json || {};
      },
      async text() {
        return JSON.stringify(next.json || { error: { message: next.message || "" } });
      },
    };
  };
  return { calls, count: () => i };
}

const geminiOk = {
  status: 200,
  json: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] },
};
const busy503 = { status: 503, message: "This model is currently experiencing high demand." };
const badKey = { status: 400, message: "API key not valid. Please pass a valid API key." };

const ask = (extra = {}) =>
  askAboutImage({
    prompt: "x",
    base64Data: "AA",
    mediaType: "image/gif",
    provider: "gemini",
    apiKey: "k",
    maxTokens: 50,
    /* The real backoff is seconds long, which is right on a phone and pure
       waiting here. The behaviour under test is which failures are retried,
       not how long the pause is. */
    delays: [1, 1],
    ...extra,
  });

/* A spike that passes: first call busy, second fine. Before this change that
 * photo was simply lost. */
let stub = stubFetch([busy503, geminiOk]);
const recovered = await ask();
check("a busy model is tried again and succeeds", recovered, { ok: true });
check("which took two calls", stub.count(), 2);

/* Still busy after every attempt: the error must carry Google's own words,
 * because "try again later" is the actionable part. */
stub = stubFetch([busy503]);
let failed = null;
try {
  await ask();
} catch (e) {
  failed = e;
}
ok("a model busy throughout still fails", Boolean(failed), String(failed));
ok("after more than one attempt", stub.count() >= 3, String(stub.count()));
ok("and says the service is busy, not that the photo is bad", /忙|額度/.test(failed.message), failed.message);
ok("and does not blame her photo", !/重新拍攝|照片不/.test(failed.message), failed.message);

/* A bad key will not come right on the second attempt; retrying it only makes
 * her wait longer to be told the same thing. */
stub = stubFetch([badKey]);
let keyErr = null;
try {
  await ask();
} catch (e) {
  keyErr = e;
}
check("a bad key is not retried", stub.count(), 1);
ok("and says so plainly", /API Key/.test(keyErr.message), keyErr.message);

/* A dropped connection is the phone's problem, not the photo's — and it is
 * worth a second go, because walking back into signal fixes it. */
stub = stubFetch([{ throw: true }, geminiOk]);
check("a dropped connection is retried", await ask(), { ok: true });

/* The screen has to be able to say "retrying" rather than appear to hang. */
stub = stubFetch([busy503, geminiOk]);
const attempts = [];
await ask({ onAttempt: (info) => attempts.push(info.attempt) });
check("each attempt is announced", attempts, [1, 2]);

globalThis.fetch = realFetch;

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
