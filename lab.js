/*
 * CODE Gold labs: shared engine for the Teleop and Subsystems pages.
 *   1. Lessons, questions, hands-on tasks, progress (saved in this browser only)
 *   2. Simulation helpers (sliders, canvas drawing, challenges)
 *   3. JavaMini: a tiny interpreter for a safe subset of Java, so students can edit code and see it run
 * A page calls Lab.start({ key, lessons, challenges, sims }).
 */
"use strict";

let KEY = "cg-lab", LESSONS = [], SIM_CHALLENGES = {}, SIMS = {};
let state = {};
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const KWRE = /\b(private|public|final|static|double|int|boolean|var|new|return|if|else|this|true|false|null|void|class|extends)\b/g;
function hlLine(line) {
  let code = line, comment = "";
  const c = [line.indexOf("//"), line.indexOf("/*"), line.trimStart().startsWith("*") ? line.indexOf("*") : -1].filter(x => x >= 0);
  if (c.length) { const k = Math.min(...c); code = line.slice(0, k); comment = line.slice(k); }
  const out = code.split(/("[^"]*")/).map((p, idx) => {
    if (idx % 2 === 1) return '<span class="st">' + esc(p) + "</span>";
    return esc(p).replace(KWRE, '<span class="kw">$1</span>').replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="nu">$1</span>');
  }).join("");
  return out + (comment ? '<span class="cm">' + esc(comment) + "</span>" : "");
}
const hl = src => src.split("\n").map(hlLine).join("\n");
const allQs = () => LESSONS.flatMap(l => l.questions);
const allTasks = () => LESSONS.flatMap(l => l.tasks || []);
const allChallenges = () => Object.values(SIM_CHALLENGES).flat();
const graded = q => q.type !== "write";
const isDone = q => !!(state[q.id] && (graded(q) ? state[q.id].answered : state[q.id].revealed));
const taskDone = t => t.steps.every((_, i) => state[t.id] && state[t.id][i]);
const parseNum = s => { const v = parseFloat(String(s).replace(",", ".").replace(/[^\d.\-]/g, "")); return isNaN(v) ? null : v; };
const fmt = n => (n !== 0 && Math.abs(n) < 0.01 ? String(+n.toPrecision(3)) : String(Math.round(n * 1000) / 1000));
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, "");
const sgn = n => (n > 0 ? "+" : "") + n;

/* ---------- lessons ---------- */
function renderTask(t) {
  const el = document.createElement("div");
  el.className = "task"; el.id = "task-" + t.id;
  el.innerHTML = `<h3><span class="tag">Try it</span>${esc(t.title)}</h3><p class="need">You need: ${esc(t.need)}</p>`;
  const ol = document.createElement("ol"); ol.className = "steps";
  t.steps.forEach((s, i) => {
    const li = document.createElement("li"), id = `cb-${t.id}-${i}`;
    li.innerHTML = `<label for="${id}"><input type="checkbox" id="${id}"><span>${esc(s)}</span></label>`;
    const cb = li.querySelector("input");
    cb.checked = !!(state[t.id] && state[t.id][i]);
    cb.addEventListener("change", () => {
      state[t.id] = Object.assign({}, state[t.id], { [i]: cb.checked }); save();
      el.querySelector(".task-done").hidden = !taskDone(t); updateScore();
    });
    ol.appendChild(li);
  });
  el.appendChild(ol);
  const det = document.createElement("details"); det.className = "expect";
  det.innerHTML = `<summary>What you should see</summary><div>${esc(t.expect)}</div>`;
  el.appendChild(det);
  const d = document.createElement("span"); d.className = "task-done"; d.textContent = "Done ✓"; d.hidden = !taskDone(t);
  el.appendChild(d);
  return el;
}

function solution(ok, lead, q) {
  const fb = document.createElement("div");
  fb.className = "fb " + (ok ? "good" : "bad");
  fb.innerHTML = `<b class="${ok ? "good" : "bad"}">${ok ? "Correct." : "Not quite. " + esc(lead)}</b><span class="sh">How to work it out</span><ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;
  return fb;
}

function hintUi(q, body) {
  if (!q.hint) return;
  const s = state[q.id] || {};
  if (graded(q) && s.answered) return;
  if (s.hint) {
    const h = document.createElement("div"); h.className = "hintbox";
    h.innerHTML = `<b>Hint:</b> ${esc(q.hint)}`; body.appendChild(h); return;
  }
  const row = document.createElement("div"); row.className = "row";
  const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.id = "hint-" + q.id;
  b.textContent = "Show a hint";
  b.addEventListener("click", () => { state[q.id] = Object.assign({}, state[q.id], { hint: true }); save(); refresh(q); });
  row.appendChild(b); body.appendChild(row);
}

function renderQuestion(q, n) {
  const el = document.createElement("div");
  el.className = "q"; el.id = "q-" + q.id; el.dataset.n = n;
  const tag = q.find ? "Find it in the code" : { mc: "Pick one", num: "Work it out", text: "Work it out", write: "Explain" }[q.type];
  el.innerHTML = `<div class="q-top"><span class="q-tag${q.find ? " find" : ""}">${n} · ${tag}</span><div class="q-text">${esc(q.q)}${q.code ? `<pre><code>${hl(q.code)}</code></pre>` : ""}</div></div><div class="q-body" style="display:grid;gap:10px"></div>`;
  const body = el.querySelector(".q-body");
  const s = state[q.id] || {};

  if (q.type === "mc") {
    const opts = document.createElement("div"); opts.className = "opts";
    q.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "opt"; b.id = `opt-${q.id}-${i}`;
      b.innerHTML = `<span class="k">${"ABCD"[i]}</span><span>${esc(o)}</span>`;
      if (s.answered) {
        b.disabled = true;
        if (i === q.answer) b.classList.add("is-right");
        else if (i === s.choice) b.classList.add("is-wrong");
      }
      b.addEventListener("click", () => {
        if ((state[q.id] || {}).answered) return;
        state[q.id] = Object.assign({}, state[q.id], { answered: true, choice: i, correct: i === q.answer });
        save(); refresh(q);
      });
      opts.appendChild(b);
    });
    body.appendChild(opts);
    hintUi(q, body);
    if (s.answered) body.appendChild(solution(s.correct, "The answer is " + "ABCD"[q.answer] + ".", q));
  }

  if (q.type === "num" || q.type === "text") {
    const row = document.createElement("div"); row.className = "row";
    row.innerHTML = `<label class="sr" for="in-${q.id}">Your answer</label><input type="text" ${q.type === "num" ? 'inputmode="decimal"' : ""} id="in-${q.id}" autocomplete="off" placeholder="${esc(q.placeholder || "your answer")}">${q.unit ? `<span class="unit">${esc(q.unit)}</span>` : ""}<button class="btn" type="button" id="chk-${q.id}">Check</button>`;
    body.appendChild(row);
    const input = row.querySelector("input"), btn = row.querySelector("button");
    if (s.answered) { input.value = s.value; input.disabled = true; btn.disabled = true; }
    const check = () => {
      if ((state[q.id] || {}).answered) return;
      let ok;
      if (q.type === "num") {
        const v = parseNum(input.value);
        if (v === null) { input.focus(); return; }
        ok = Math.abs(v - q.answer) <= q.tol;
      } else {
        if (!input.value.trim()) { input.focus(); return; }
        ok = q.accept.some(a => norm(a) === norm(input.value));
      }
      state[q.id] = Object.assign({}, state[q.id], { answered: true, value: input.value, correct: ok });
      save(); refresh(q);
    };
    btn.addEventListener("click", check);
    input.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    hintUi(q, body);
    if (s.answered) {
      const ans = q.type === "num" ? fmt(q.answer) + (q.unit ? " " + q.unit : "") : q.accept[0];
      body.appendChild(solution(s.correct, "The answer is " + ans + ".", q));
    }
  }

  if (q.type === "write") {
    const ta = document.createElement("textarea");
    ta.id = "ta-" + q.id; ta.placeholder = "Type your answer, then compare it with the model answer.";
    ta.setAttribute("aria-label", "Your answer");
    ta.value = s.text || "";
    const row = document.createElement("div"); row.className = "row";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn"; btn.id = "rev-" + q.id;
    btn.textContent = "Show model answer";
    const note = document.createElement("span"); note.className = "hint";
    const sync = () => { const ok = ta.value.trim().length >= 20; btn.disabled = !ok || !!(state[q.id] || {}).revealed; note.textContent = ok || (state[q.id] || {}).revealed ? "" : "Write at least a sentence first."; };
    ta.addEventListener("input", () => { state[q.id] = Object.assign({}, state[q.id], { text: ta.value }); save(); sync(); });
    btn.addEventListener("click", () => { state[q.id] = Object.assign({}, state[q.id], { text: ta.value, revealed: true }); save(); refresh(q); });
    row.append(btn, note);
    body.append(ta, row);
    sync();
    hintUi(q, body);
    if (s.revealed) {
      const fb = document.createElement("div"); fb.className = "fb neutral";
      fb.innerHTML = `<b class="neutral">Model answer</b><span>${esc(q.model)}</span><span class="hint">Check yours: did it name the same main idea, and give a reason? If not, reread the lab and try saying it out loud to a teammate.</span>`;
      body.appendChild(fb);
    }
  }

  if (s.answered && graded(q)) el.classList.add(s.correct ? "right" : "wrong");
  return el;
}

function refresh(q) {
  const old = document.getElementById("q-" + q.id);
  old.replaceWith(renderQuestion(q, old.dataset.n));
  updateScore();
}

const REDRAWS = [];
const STOPPERS = [];
function renderAll() {
  STOPPERS.splice(0).forEach(f => f());
  REDRAWS.length = 0;
  const host = document.getElementById("lessons"); host.innerHTML = "";
  const toc = document.getElementById("toc"); toc.innerHTML = "";
  const pendingSims = [];
  LESSONS.forEach((l, li) => {
    const num = String(li + 1).padStart(2, "0");
    const sec = document.createElement("section");
    sec.className = "lesson"; sec.id = l.id;
    sec.innerHTML = `
      <div class="lesson-head"><span class="num">${num}</span><h2>${esc(l.title)}${l.status ? `<span class="status">${esc(l.status)}</span>` : ""}</h2><span class="where">${esc(l.where)}</span></div>
      <div class="prose">${l.body}</div>
      ${l.code ? `<pre><code>${hl(l.code)}</code></pre>` : ""}`;
    if (l.sims) l.sims.forEach(name => { const hs = document.createElement("div"); hs.className = "sims"; sec.appendChild(hs); pendingSims.push([name, hs]); });
    if (l.tasks && l.tasks.length) {
      const tw = document.createElement("div"); tw.className = "tasks";
      tw.innerHTML = `<span class="block-label">Hands-on</span>`;
      l.tasks.forEach(t => tw.appendChild(renderTask(t)));
      sec.appendChild(tw);
    }
    const checks = document.createElement("div"); checks.className = "checks";
    checks.innerHTML = `<span class="block-label">Check your understanding</span>`;
    l.questions.forEach((q, qi) => checks.appendChild(renderQuestion(q, `${li + 1}.${qi + 1}`)));
    sec.appendChild(checks);
    host.appendChild(sec);
    const item = document.createElement("li");
    item.innerHTML = `<a href="#${l.id}"><span class="n">${num}</span><span>${esc(l.title)}</span><span class="c" id="toc-${l.id}"></span></a>`;
    toc.appendChild(item);
  });
  pendingSims.forEach(([name, hs]) => SIMS[name](hs));
  updateScore();
}

function updateScore() {
  const qs = allQs(), g = qs.filter(graded), tasks = allTasks(), chs = allChallenges();
  const right = g.filter(q => state[q.id] && state[q.id].correct).length;
  const answered = qs.filter(isDone).length;
  const tdone = tasks.filter(taskDone).length;
  const chDone = chs.filter(c => state["ch-" + c.id]).length;
  document.getElementById("scoreRight").textContent = right;
  document.getElementById("scoreTotal").textContent = g.length;
  document.getElementById("scoreSub").textContent = `${answered} of ${qs.length} questions answered`;
  document.getElementById("taskSub").textContent = `${tdone} of ${tasks.length} hands-on tasks done`;
  document.getElementById("simSub").textContent = `${chDone} of ${chs.length} sim challenges done`;
  document.getElementById("scoreBar").style.width = (answered / qs.length * 100) + "%";
  const list = document.getElementById("doneList"); list.innerHTML = "";
  LESSONS.forEach(l => {
    const done = l.questions.filter(isDone).length, lg = l.questions.filter(graded);
    const lr = lg.filter(q => state[q.id] && state[q.id].correct).length;
    const c = document.getElementById("toc-" + l.id);
    c.textContent = `${done}/${l.questions.length}`;
    c.classList.toggle("done", done === l.questions.length);
    if (done === l.questions.length && lr < lg.length) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="#${l.id}">${esc(l.title)}</a>: ${lr} of ${lg.length} right. Reread the worked solutions for the ones you missed.`;
      list.appendChild(li);
    }
  });
  const text = document.getElementById("doneText");
  if (answered < qs.length) {
    text.textContent = `${qs.length - answered} questions to go. Answer every question to see your result here.`;
  } else {
    const pct = Math.round(right / g.length * 100);
    text.textContent = pct >= 85
      ? `${right} of ${g.length} correct (${pct}%). You know this well enough to teach it. Pick a lab and walk a teammate through it.`
      : `${right} of ${g.length} correct (${pct}%). Go back to the labs below, read the worked solutions, then talk through them with a teammate or mentor.`;
    if (chDone < chs.length) text.textContent += ` You also have ${chs.length - chDone} sim challenges left.`;
  }
}

/* ---------- simulation helpers ---------- */
const css = n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim();
const REDUCE = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function fit(canvas, h) {
  const w = Math.max(260, canvas.parentElement.clientWidth);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.font = "12px " + css("font-mono"); ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.lineCap = "round";
  return { w, h, ctx };
}
function ln(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function txt(ctx, s, x, y, color, align) { ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.fillText(s, x, y); }

/* A fixed-step loop (20 ms, like the robot) that only runs while its element is on screen. */
function robotLoop(el, step, draw) {
  let raf = 0, last = 0, acc = 0, visible = true, stopped = false;
  // window.LAB_ALWAYS_RUN = true keeps every simulation running even off screen (used by automated tests)
  const io = !window.LAB_ALWAYS_RUN && "IntersectionObserver" in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }) : null;
  if (io) io.observe(el);
  function frame(now) {
    raf = 0;
    if (stopped || !visible) return;
    if (!last) last = now;
    acc += Math.min(0.25, (now - last) / 1000); last = now;
    while (acc >= 0.02) { step(); acc -= 0.02; }
    draw();
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !stopped) { last = 0; raf = requestAnimationFrame(frame); } }
  kick();
  const stop = () => { stopped = true; if (raf) cancelAnimationFrame(raf); if (io) io.disconnect(); const k = LOOPS.indexOf(entry); if (k >= 0) LOOPS.splice(k, 1); };
  const entry = { step, draw };
  LOOPS.push(entry);
  STOPPERS.push(stop);
  return { stop };
}
/* Automated tests can advance every simulation by a set time without waiting for the screen. */
const LOOPS = [];
window.__labAdvance = secs => LOOPS.forEach(l => { for (let i = 0; i < Math.round(secs / 0.02); i++) l.step(); l.draw(); });

function challengeList(el, id) {
  const chWrap = document.createElement("div"); chWrap.className = "challenges";
  chWrap.innerHTML = `<span class="block-label">Challenges</span>`;
  const ul = document.createElement("ul");
  // Each challenge: { id, goal, steps: [...], done, hint?, answer?, answerCode? }.
  // Text may use `backticks` for inline code.
  const md = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  SIM_CHALLENGES[id].forEach((c, n) => {
    const li = document.createElement("li"); li.id = "ch-" + c.id;
    li.innerHTML = `<span class="mark" aria-hidden="true"></span><div class="ch-body">
      <p class="ch-goal"><span class="ch-num">${n + 1}.</span> ${md(c.goal)}</p>
      <ol class="ch-steps">${c.steps.map(s => `<li>${md(s)}</li>`).join("")}</ol>
      <p class="ch-done"><b>Done when:</b> ${md(c.done)}</p>
      ${c.hint ? `<details class="ch-more"><summary>Stuck? Hint</summary><div>${md(c.hint)}</div></details>` : ""}
      ${c.answer || c.answerCode ? `<details class="ch-more"><summary>Check your answer</summary><div>${c.answer ? `<p>${md(c.answer)}</p>` : ""}${c.answerCode ? `<pre><code>${esc(c.answerCode)}</code></pre>` : ""}</div></details>` : ""}
    </div>`;
    ul.appendChild(li);
  });
  chWrap.appendChild(ul); el.appendChild(chWrap);
  const paint = () => SIM_CHALLENGES[id].forEach(({ id: cid }) => {
    const li = document.getElementById("ch-" + cid), d = !!state["ch-" + cid];
    li.classList.toggle("done", d); li.querySelector(".mark").textContent = d ? "✓" : "○";
  });
  paint();
  return cid => { if (state["ch-" + cid]) return; state["ch-" + cid] = true; save(); paint(); updateScore(); };
}

/* A simulation whose behavior comes from code the student edits. */
function buildCodeSim(host, cfg) {
  const el = document.createElement("div"); el.className = "sim code-sim";
  el.innerHTML = `<h3><span class="tag">Change the code</span>${esc(cfg.title)}</h3><p class="need">${esc(cfg.intro)}</p>`;
  const ed = document.createElement("div"); ed.className = "editor";
  const gutter = document.createElement("pre"); gutter.className = "gutter"; gutter.setAttribute("aria-hidden", "true");
  const ta = document.createElement("textarea");
  ta.id = "code-" + cfg.id; ta.spellcheck = false; ta.wrap = "off";
  ta.setAttribute("aria-label", "Java code for " + cfg.title);
  ta.setAttribute("autocapitalize", "off"); ta.setAttribute("autocomplete", "off");
  ta.value = typeof state["code-" + cfg.id] === "string" ? state["code-" + cfg.id] : cfg.code;
  ed.append(gutter, ta); el.appendChild(ed);
  const row = document.createElement("div"); row.className = "row";
  row.innerHTML = `<button class="btn" type="button" id="build-${cfg.id}">Build &amp; run</button><button class="btn ghost" type="button" id="reset-${cfg.id}">Reset to the original code</button><span class="hint">Ctrl+Enter also builds. Only a small part of Java works here: numbers, true/false, + − * / %, if/else, and the methods named above.</span>`;
  el.appendChild(row);
  const status = document.createElement("div"); status.className = "build idle"; status.setAttribute("aria-live", "polite");
  el.appendChild(status);
  const extra = document.createElement("div"); extra.style.display = "grid"; extra.style.gap = "12px"; el.appendChild(extra);
  const cw = document.createElement("div"); cw.className = "sim-canvas";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", cfg.aria);
  if (cfg.focusable) canvas.tabIndex = 0;
  cw.appendChild(canvas); el.appendChild(cw);
  const ro = document.createElement("div"); ro.className = "readouts"; el.appendChild(ro);
  host.appendChild(el);
  const complete = challengeList(el, cfg.id);

  let errLine = 0, prog = null;
  const paintGutter = () => {
    const n = ta.value.split("\n").length;
    gutter.innerHTML = Array.from({ length: n }, (_, i) => i + 1 === errLine ? `<span class="err">${i + 1}</span>` : String(i + 1)).join("\n");
    ta.rows = Math.max(6, n + 1);
  };
  ta.addEventListener("input", () => { state["code-" + cfg.id] = ta.value; save(); paintGutter(); });
  ta.addEventListener("scroll", () => { gutter.scrollTop = ta.scrollTop; });
  ta.addEventListener("keydown", e => {
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 4;
      ta.dispatchEvent(new Event("input"));
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); build(true); }
  });
  function fail(line, msg) {
    errLine = line || 0; prog = null; paintGutter();
    status.className = "build fail";
    status.textContent = `BUILD FAILED\n${line ? "Line " + line + ": " : ""}${msg}`;
    if (cfg.onFail) cfg.onFail();
  }
  function build(user) {
    const c = JavaMini.compile(ta.value);
    if (c.error) return fail(c.error.line, c.error.message);
    const problem = cfg.check ? cfg.check(c.ast) : null;
    if (problem) return fail(problem.line, problem.message);
    errLine = 0; prog = c.ast; paintGutter();
    status.className = "build ok";
    status.textContent = "BUILD SUCCESSFUL: your code is running in the simulation.";
    if (cfg.onBuilt) cfg.onBuilt(prog, user);
  }
  row.querySelector(`#build-${cfg.id}`).addEventListener("click", () => build(true));
  row.querySelector(`#reset-${cfg.id}`).addEventListener("click", () => {
    ta.value = cfg.code; state["code-" + cfg.id] = cfg.code; save(); build(false);
  });
  paintGutter();
  return {
    canvas, extra, complete,
    program: () => prog,
    build,
    runtimeError(e) { fail(e.line, e.message + " (while running)"); },
    readouts(rows) { ro.innerHTML = rows.map(([l, v, cls]) => `<div class="ro${cls ? " " + cls : ""}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join(""); }
  };
}

/* An on-screen joystick. Returns { x, y } in -1..1 (up is -1, like an Xbox controller). */
function makeStick(parent, label, id) {
  const wrap = document.createElement("div"); wrap.className = "stick-wrap";
  const st = document.createElement("div"); st.className = "stick"; st.id = id; st.tabIndex = 0;
  st.setAttribute("role", "slider"); st.setAttribute("aria-label", label + " (drag, or use the arrow keys)");
  const knob = document.createElement("div"); knob.className = "knob"; st.appendChild(knob);
  const lab = document.createElement("span"); lab.className = "stick-label"; lab.textContent = label;
  wrap.append(st, lab); parent.appendChild(wrap);
  const val = { x: 0, y: 0 }, keys = {};
  const paint = () => { knob.style.left = (40 + val.x * 40) + "px"; knob.style.top = (40 + val.y * 40) + "px"; st.setAttribute("aria-valuetext", `x ${val.x.toFixed(2)}, y ${val.y.toFixed(2)}`); };
  const setFrom = e => {
    const r = st.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2 - 20), y = (e.clientY - r.top - r.height / 2) / (r.height / 2 - 20);
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    val.x = x; val.y = y; paint();
  };
  st.addEventListener("pointerdown", e => { try { st.setPointerCapture(e.pointerId); } catch (er) {} setFrom(e); });
  st.addEventListener("pointermove", e => { if (st.hasPointerCapture(e.pointerId)) setFrom(e); });
  const release = () => { val.x = 0; val.y = 0; paint(); };
  st.addEventListener("pointerup", release); st.addEventListener("pointercancel", release);
  const keyMap = { ArrowLeft: ["x", -1], ArrowRight: ["x", 1], ArrowUp: ["y", -1], ArrowDown: ["y", 1] };
  const fromKeys = () => { val.x = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); val.y = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0); paint(); };
  st.addEventListener("keydown", e => { if (keyMap[e.key]) { e.preventDefault(); keys[e.key] = true; fromKeys(); } });
  st.addEventListener("keyup", e => { if (keyMap[e.key]) { keys[e.key] = false; fromKeys(); } });
  st.addEventListener("blur", () => { for (const k in keys) keys[k] = false; release(); });
  paint();
  return val;
}

/* A button you press and hold (pointer or keyboard). */
function makeHold(parent, label, id, onChange) {
  const b = document.createElement("button"); b.type = "button"; b.className = "hold-btn"; b.id = id; b.textContent = label;
  b.setAttribute("aria-pressed", "false");
  let down = false;
  const set = d => { if (d === down) return; down = d; b.classList.toggle("down", d); b.setAttribute("aria-pressed", String(d)); if (onChange) onChange(d); };
  b.addEventListener("pointerdown", e => { try { b.setPointerCapture(e.pointerId); } catch (er) {} set(true); });
  b.addEventListener("pointerup", () => set(false)); b.addEventListener("pointercancel", () => set(false));
  b.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); set(true); } });
  b.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") set(false); });
  b.addEventListener("blur", () => set(false));
  parent.appendChild(b);
  return { get down() { return down; }, set };
}

/* ---------- JavaMini: a tiny, safe interpreter for a subset of Java ---------- */
const JavaMini = (() => {
  class JErr extends Error { constructor(line, msg) { super(msg); this.line = line; } }
  const KW = new Set(["double", "int", "boolean", "var", "final", "private", "public", "static", "if", "else", "return", "true", "false", "new", "for", "while", "do", "String", "void", "class", "float", "long"]);
  const TYPES = new Set(["double", "int", "boolean", "var", "float", "long"]);
  function tokenize(src) {
    const toks = []; let i = 0, line = 1;
    const push = (type, value) => toks.push({ type, value, line });
    while (i < src.length) {
      const c = src[i];
      if (c === "\n") { line++; i++; continue; }
      if (c === " " || c === "\t" || c === "\r") { i++; continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { const j = src.indexOf("*/", i + 2), end = j < 0 ? src.length : j + 2; for (let k = i; k < end; k++) if (src[k] === "\n") line++; i = end; continue; }
      const rest = src.slice(i, i + 80);
      let m = /^(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?[dDfF]?/.exec(rest);
      if (m) { const raw = m[0]; push("num", { v: parseFloat(raw.replace(/[dDfF]$/, "")), t: /[.eEdDfF]/.test(raw) ? "double" : "int" }); i += raw.length; continue; }
      m = /^[A-Za-z_]\w*/.exec(rest);
      if (m) { push(KW.has(m[0]) ? "kw" : "id", m[0]); i += m[0].length; continue; }
      const two = src.substr(i, 2);
      if (["==", "!=", "<=", ">=", "&&", "||", "+=", "-=", "*=", "/=", "++", "--", "->"].includes(two)) { push("op", two); i += 2; continue; }
      if ("+-*/%()<>!?:.,;={}".includes(c)) { push("op", c); i++; continue; }
      if (c === '"') throw new JErr(line, "text in quotes (a String) isn't supported in this editor");
      throw new JErr(line, `illegal character: '${c}'`);
    }
    push("eof", null);
    return toks;
  }

  function parse(src) {
    const t = tokenize(src); let p = 0;
    const peek = (k = 0) => t[Math.min(p + k, t.length - 1)], next = () => t[p++];
    const is = (type, value) => peek().type === type && (value === undefined || peek().value === value);
    const isOp = v => is("op", v);
    const prevLine = () => (p > 0 ? t[p - 1].line : 1);
    const expect = v => { if (!isOp(v)) throw new JErr(v === ";" ? prevLine() : peek().line, `'${v}' expected`); return next(); };
    const semi = () => expect(";");

    function block() {
      const line = peek().line; expect("{"); const body = [];
      while (!isOp("}")) { if (is("eof")) throw new JErr(prevLine(), "reached end of file while parsing (a '}' is missing)"); body.push(statement()); }
      next(); return { k: "block", body, line };
    }
    function statement() {
      const line = peek().line;
      if (isOp("{")) return block();
      if (isOp(";")) { next(); return { k: "empty", line }; }
      if (isOp("}")) throw new JErr(line, "class, interface, or enum expected (there's an extra '}')");
      if (is("kw", "if")) {
        next(); expect("("); const cond = expr(); expect(")");
        const then = statement(); let els = null;
        if (is("kw", "else")) { next(); els = statement(); }
        return { k: "if", cond, then, els, line };
      }
      if (is("kw", "else")) throw new JErr(line, "'else' without 'if'");
      if (is("kw", "for") || is("kw", "while") || is("kw", "do")) throw new JErr(line, "loops aren't supported in this editor (this code already runs again every 20 ms)");
      if (is("kw", "return")) throw new JErr(line, "no return needed here: set the variable instead");
      if (is("kw", "String")) throw new JErr(line, "String variables aren't supported in this editor");
      let final = false;
      while (is("kw", "final") || is("kw", "private") || is("kw", "public") || is("kw", "static")) { if (peek().value === "final") final = true; next(); }
      if (is("kw") && TYPES.has(peek().value)) {
        let type = next().value;
        if (type === "float") type = "double";
        if (type === "long") type = "int";
        if (!is("id")) throw new JErr(peek().line, "<identifier> expected (a variable name)");
        const name = next().value;
        let init = null;
        if (isOp("=")) { next(); init = expr(); }
        semi();
        return { k: "decl", type, name, init, final, line };
      }
      if (is("id") && peek(1).type === "id") throw new JErr(line, `cannot find symbol: class ${peek().value} (is the type spelled right? try double, int or boolean)`);
      if (is("id") && peek(1).type === "op" && ["=", "+=", "-=", "*=", "/="].includes(peek(1).value)) {
        const name = next().value, op = next().value, e = expr(); semi();
        return { k: "assign", name, op, e, line };
      }
      if (is("id") && peek(1).type === "op" && (peek(1).value === "++" || peek(1).value === "--")) {
        const name = next().value, op = next().value; semi();
        return { k: "assign", name, op: op === "++" ? "+=" : "-=", e: { k: "num", v: 1, t: "int", line }, line };
      }
      const e = expr();
      if (e.k !== "call") throw new JErr(line, "not a statement");
      semi();
      return { k: "expr", e, line };
    }
    const expr = () => ternary();
    function ternary() {
      const c = orE();
      if (isOp("?")) { const line = next().line; const a = expr(); expect(":"); const b = expr(); return { k: "tern", c, a, b, line }; }
      return c;
    }
    function bin(nextFn, ops) {
      return () => {
        let l = nextFn();
        while (is("op") && ops.includes(peek().value)) { const tok = next(); const r = nextFn(); l = { k: "bin", op: tok.value, l, r, line: tok.line }; }
        return l;
      };
    }
    function unary() {
      if (isOp("-") || isOp("!") || isOp("+")) { const tok = next(); return { k: "un", op: tok.value, e: unary(), line: tok.line }; }
      if (isOp("(") && peek(1).type === "kw" && (peek(1).value === "int" || peek(1).value === "double") && peek(2).type === "op" && peek(2).value === ")") {
        const line = next().line; const type = next().value; next(); return { k: "cast", type, e: unary(), line };
      }
      return postfix();
    }
    const mul = bin(unary, ["*", "/", "%"]), add = bin(mul, ["+", "-"]), rel = bin(add, ["<", ">", "<=", ">="]);
    const eq = bin(rel, ["==", "!="]), andE = bin(eq, ["&&"]), orE = bin(andE, ["||"]);
    function postfix() {
      let e = primary();
      for (;;) {
        if (isOp(".")) {
          next();
          if (!is("id")) throw new JErr(peek().line, "<identifier> expected after '.'");
          const tok = next(); e = { k: "mem", o: e, name: tok.value, line: tok.line };
        } else if (isOp("(")) {
          const line = next().line, args = [];
          if (!isOp(")")) { args.push(expr()); while (isOp(",")) { next(); args.push(expr()); } }
          expect(")");
          e = { k: "call", f: e, args, line };
        } else return e;
      }
    }
    function primary() {
      const tok = peek();
      if (tok.type === "num") { next(); return { k: "num", v: tok.value.v, t: tok.value.t, line: tok.line }; }
      if (tok.type === "kw" && (tok.value === "true" || tok.value === "false")) { next(); return { k: "bool", v: tok.value === "true", line: tok.line }; }
      if (tok.type === "id") { next(); return { k: "id", name: tok.value, line: tok.line }; }
      if (isOp("(")) { next(); const e = expr(); expect(")"); return e; }
      if (tok.type === "kw" && tok.value === "new") throw new JErr(tok.line, "creating objects with 'new' isn't supported in this editor");
      if (tok.type === "eof") throw new JErr(prevLine(), "reached end of file while parsing");
      throw new JErr(tok.line, `illegal start of expression${tok.value ? ": '" + tok.value + "'" : ""}`);
    }
    const body = [];
    while (!is("eof")) body.push(statement());
    return body;
  }

  const isNum = x => x.t === "int" || x.t === "double";
  const tname = x => (x.t === "obj" ? x.v.cls : x.t);
  function assignCheck(type, val, line) {
    if (type === "double" && isNum(val)) return { t: "double", v: val.v };
    if (type === "int" && val.t === "int") return val;
    if (type === "int" && val.t === "double") throw new JErr(line, "incompatible types: possible lossy conversion from double to int");
    if (type === "boolean" && val.t === "boolean") return val;
    if (type === "obj" && val.t === "obj") return val;
    throw new JErr(line, `incompatible types: ${tname(val)} cannot be converted to ${type}`);
  }
  function run(ast, opts) {
    const globals = opts.globals || {};
    const inputs = new Map(Object.entries(opts.inputs || {}).map(([k, v]) => [k, { val: v, type: v.t === "obj" ? "obj" : v.t, final: true, input: true }]));
    const top = new Map(), scopes = [inputs, top];
    const lookup = name => { for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name); return null; };
    function ev(n) {
      switch (n.k) {
        case "num": return { t: n.t, v: n.v };
        case "bool": return { t: "boolean", v: n.v };
        case "id": {
          const s = lookup(n.name);
          if (s) { if (s.val === undefined) throw new JErr(n.line, `variable ${n.name} might not have been initialized`); return s.val; }
          if (Object.prototype.hasOwnProperty.call(globals, n.name)) return globals[n.name];
          throw new JErr(n.line, `cannot find symbol: variable ${n.name}`);
        }
        case "mem": {
          const o = ev(n.o);
          if (o.t !== "obj") throw new JErr(n.line, `${tname(o)} cannot be dereferenced`);
          const f = o.v.fields && o.v.fields[n.name];
          if (f !== undefined) return f;
          if (o.v.methods && o.v.methods[n.name]) throw new JErr(n.line, `${n.name} is a method: add () to call it, like ${n.name}()`);
          throw new JErr(n.line, `cannot find symbol: ${o.v.cls}.${n.name}`);
        }
        case "call": {
          if (n.f.k !== "mem") throw new JErr(n.line, `cannot find symbol: method ${n.f.name || ""}()`);
          const o = ev(n.f.o);
          if (o.t !== "obj") throw new JErr(n.line, `${tname(o)} cannot be dereferenced`);
          const m = o.v.methods && o.v.methods[n.f.name];
          if (!m) throw new JErr(n.line, `cannot find symbol: method ${n.f.name}() in ${o.v.cls}`);
          return m(n.args.map(ev), n.line, n.f.name);
        }
        case "un": {
          const v = ev(n.e);
          if (n.op === "!") { if (v.t !== "boolean") throw new JErr(n.line, `bad operand type ${tname(v)} for unary operator '!'`); return { t: "boolean", v: !v.v }; }
          if (!isNum(v)) throw new JErr(n.line, `bad operand type ${tname(v)} for unary operator '${n.op}'`);
          return { t: v.t, v: n.op === "-" ? -v.v : v.v };
        }
        case "cast": {
          const v = ev(n.e);
          if (!isNum(v)) throw new JErr(n.line, `incompatible types: ${tname(v)} cannot be converted to ${n.type}`);
          return n.type === "int" ? { t: "int", v: Math.trunc(v.v) } : { t: "double", v: v.v };
        }
        case "bin": {
          if (n.op === "&&" || n.op === "||") {
            const l = ev(n.l);
            if (l.t !== "boolean") throw new JErr(n.line, `bad operand types for binary operator '${n.op}' (needs true/false on both sides)`);
            if (n.op === "&&" && !l.v) return l;
            if (n.op === "||" && l.v) return l;
            const r = ev(n.r);
            if (r.t !== "boolean") throw new JErr(n.line, `bad operand types for binary operator '${n.op}' (needs true/false on both sides)`);
            return r;
          }
          const l = ev(n.l), r = ev(n.r);
          if (n.op === "==" || n.op === "!=") {
            if (!((isNum(l) && isNum(r)) || l.t === r.t)) throw new JErr(n.line, `incomparable types: ${tname(l)} and ${tname(r)}`);
            const same = l.t === "obj" ? l.v === r.v : l.v === r.v;
            return { t: "boolean", v: n.op === "==" ? same : !same };
          }
          if (!isNum(l) || !isNum(r)) throw new JErr(n.line, `bad operand types for binary operator '${n.op}': ${tname(l)} and ${tname(r)}`);
          const dbl = l.t === "double" || r.t === "double", t = dbl ? "double" : "int";
          switch (n.op) {
            case "+": return { t, v: l.v + r.v };
            case "-": return { t, v: l.v - r.v };
            case "*": return { t, v: l.v * r.v };
            case "/":
              if (!dbl) { if (r.v === 0) throw new JErr(n.line, "ArithmeticException: / by zero"); return { t, v: Math.trunc(l.v / r.v) }; }
              return { t, v: l.v / r.v };
            case "%":
              if (!dbl && r.v === 0) throw new JErr(n.line, "ArithmeticException: / by zero");
              return { t, v: l.v % r.v };
            case "<": return { t: "boolean", v: l.v < r.v };
            case ">": return { t: "boolean", v: l.v > r.v };
            case "<=": return { t: "boolean", v: l.v <= r.v };
            case ">=": return { t: "boolean", v: l.v >= r.v };
          }
          throw new JErr(n.line, `unknown operator ${n.op}`);
        }
        case "tern": {
          const c = ev(n.c);
          if (c.t !== "boolean") throw new JErr(n.line, `incompatible types: ${tname(c)} cannot be converted to boolean`);
          const a = ev(n.a), b = ev(n.b);
          if (isNum(a) && isNum(b)) { const tt = a.t === "double" || b.t === "double" ? "double" : "int"; return { t: tt, v: c.v ? a.v : b.v }; }
          if (a.t !== b.t) throw new JErr(n.line, `incompatible types in ? : (${tname(a)} and ${tname(b)})`);
          return c.v ? a : b;
        }
      }
      throw new JErr(n.line, "can't run this expression");
    }
    function exec(s) {
      switch (s.k) {
        case "empty": return;
        case "block": scopes.push(new Map()); try { s.body.forEach(exec); } finally { scopes.pop(); } return;
        case "if": {
          const c = ev(s.cond);
          if (c.t !== "boolean") throw new JErr(s.line, `incompatible types: ${tname(c)} cannot be converted to boolean (an if needs true/false)`);
          if (c.v) exec(s.then); else if (s.els) exec(s.els);
          return;
        }
        case "decl": {
          const cur = scopes[scopes.length - 1];
          if (cur.has(s.name) || inputs.has(s.name)) throw new JErr(s.line, `variable ${s.name} is already defined`);
          if (Object.prototype.hasOwnProperty.call(globals, s.name)) throw new JErr(s.line, `${s.name} is already the name of something in the robot code: pick another name`);
          let type = s.type, val;
          if (s.init) {
            const v = ev(s.init);
            if (type === "var") type = v.t === "obj" ? "obj" : v.t;
            val = assignCheck(type, v, s.line);
          } else if (type === "var") throw new JErr(s.line, "cannot infer type for local variable (var needs a value)");
          cur.set(s.name, { val, type, final: s.final });
          return;
        }
        case "assign": {
          const sl = lookup(s.name);
          if (!sl) {
            if (Object.prototype.hasOwnProperty.call(globals, s.name)) throw new JErr(s.line, `cannot assign a value to ${s.name}`);
            throw new JErr(s.line, `cannot find symbol: variable ${s.name} (declare it first, like: double ${s.name} = ...;)`);
          }
          if (sl.final) throw new JErr(s.line, `cannot assign a value to final variable ${s.name}${sl.input ? " (it comes from the sensors)" : ""}`);
          let v = ev(s.e);
          // x += 1.5 on an int is allowed in Java (it casts for you); plain x = x + 1.5 is not.
          if (s.intCast && sl.type === "int" && v.t === "double") v = { t: "int", v: Math.trunc(v.v) };
          sl.val = assignCheck(sl.type, v, s.line);
          return;
        }
        case "expr": ev(s.e); return;
      }
    }
    ast.forEach(exec);
    const vars = {};
    top.forEach((s, k) => { if (s.val !== undefined) vars[k] = s.val.t === "obj" ? s.val.v : s.val.v; });
    return vars;
  }

  /* Library objects the code can use. */
  const D = v => ({ t: "double", v }), I = v => ({ t: "int", v }), B = v => ({ t: "boolean", v });
  const obj = (cls, fields, methods) => ({ t: "obj", v: { cls, fields: fields || {}, methods: methods || {} } });
  function nm(n, impl, ret) {
    return (args, line, name) => {
      if (args.length !== n) throw new JErr(line, `method ${name} needs ${n} number${n === 1 ? "" : "s"} in the ( ), but got ${args.length}`);
      args.forEach(a => { if (!isNum(a)) throw new JErr(line, `incompatible types: ${tname(a)} cannot be converted to double`); });
      const v = impl(...args.map(a => a.v));
      if (ret === "same") return args.every(a => a.t === "int") ? I(v) : D(v);
      if (ret === "int") return I(v);
      if (ret === "boolean") return B(v);
      return D(v);
    };
  }
  const MathObj = obj("Math", { PI: D(Math.PI), E: D(Math.E) }, {
    abs: nm(1, Math.abs, "same"), sqrt: nm(1, Math.sqrt), pow: nm(2, Math.pow), min: nm(2, Math.min, "same"), max: nm(2, Math.max, "same"),
    copySign: nm(2, (a, b) => Math.abs(a) * (b < 0 || Object.is(b, -0) ? -1 : 1)), signum: nm(1, Math.sign),
    toRadians: nm(1, a => a * Math.PI / 180), toDegrees: nm(1, a => a * 180 / Math.PI),
    sin: nm(1, Math.sin), cos: nm(1, Math.cos), tan: nm(1, Math.tan), atan2: nm(2, Math.atan2), hypot: nm(2, Math.hypot),
    round: nm(1, a => Math.floor(a + 0.5), "int"), floor: nm(1, Math.floor), ceil: nm(1, Math.ceil)
  });
  const MathUtilObj = obj("MathUtil", {}, {
    clamp: nm(3, (v, lo, hi) => Math.max(lo, Math.min(hi, v)), "same"),
    applyDeadband: nm(2, (v, d) => (Math.abs(v) > d ? (v - Math.sign(v) * d) / (1 - d) : 0))
  });
  const UnitsObj = obj("Units", {}, { degreesToRadians: nm(1, a => a * Math.PI / 180), radiansToDegrees: nm(1, a => a * 180 / Math.PI) });

  return {
    JErr, D, I, B, obj, nm,
    std: { Math: MathObj, MathUtil: MathUtilObj, Units: UnitsObj },
    compile(src) {
      try { return { ast: parse(src) }; }
      catch (e) { if (e instanceof JErr) return { error: e }; return { error: new JErr(0, "the editor got confused by this code: " + e.message) }; }
    },
    run(ast, opts) { return runFixed(ast, opts); }
  };

  function runFixed(ast, opts) {
    // Rewrite compound assignments (x += e) into x = x + e before running.
    const rw = s => {
      if (!s) return s;
      if (s.k === "assign" && s.op !== "=") return { k: "assign", name: s.name, op: "=", e: { k: "bin", op: s.op[0], l: { k: "id", name: s.name, line: s.line }, r: s.e, line: s.line }, line: s.line, intCast: true };
      if (s.k === "block") return Object.assign({}, s, { body: s.body.map(rw) });
      if (s.k === "if") return Object.assign({}, s, { then: rw(s.then), els: rw(s.els) });
      return s;
    };
    return run(ast.map(rw), opts);
  }
})();

/* ---------- start ---------- */
const Lab = {
  start(cfg) {
    KEY = cfg.key; LESSONS = cfg.lessons; SIM_CHALLENGES = cfg.challenges || {}; SIMS = cfg.sims || {};
    try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }
    const resetBtn = document.getElementById("resetBtn");
    let armTimer = null;
    resetBtn.addEventListener("click", () => {
      if (!resetBtn.classList.contains("armed")) {
        resetBtn.classList.add("armed"); resetBtn.textContent = "Click again to erase all progress";
        armTimer = setTimeout(() => { resetBtn.classList.remove("armed"); resetBtn.textContent = "Reset progress"; }, 4000);
        return;
      }
      clearTimeout(armTimer);
      state = {}; save(); renderAll();
      resetBtn.classList.remove("armed"); resetBtn.textContent = "Reset progress";
    });
    let resizeTimer = 0;
    const redrawAll = () => REDRAWS.forEach(f => f());
    window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redrawAll, 120); });
    try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll); } catch (e) {}
    new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    renderAll();
  }
};
