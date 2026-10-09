/* ---------- 기본 데이터 (events.json 이 없을 때 사용) ---------- */
import { parseCSV, csvToEvents } from "./loader.js";
import { KYOSI } from "./kyosi.js";
const FALLBACK_EVENTS = null;

/* 날짜 키("2026-10-14")와 교시로 과목명을 찾는다. 없으면 null */
function subjectOf(k, kyosi) {
  const n = Number(kyosi);
  if (kyosi === null || kyosi === undefined || !Number.isInteger(n) || n < 1)
    return null;
  const [y, m, d] = k.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=일, 1=월 ... 6=토
  const row = KYOSI[dow - 1]; // 월(1) → KYOSI[0]
  return row?.[n - 1] ?? null; // 1교시 → 열 0
}

/* ---------- 공휴일 (필요 시 직접 추가) ---------- */
const HOLIDAYS = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일(삼일절)",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-03": "지방선거",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일(개천절)",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

let byDate = {};
let now = new Date();
let viewY = now.getFullYear(),
  viewM = now.getMonth();
let pinned = false;
let suhangOnly = false; // 수행만 보기 모드

/* "26.10.19" / "2026.10.19" / "2026-10-19" 모두 허용 */
function parseDate(s) {
  const p = String(s)
    .trim()
    .split(/[.\-\/]/)
    .map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  let [y, m, d] = p;
  if (y < 100) y += 2000;
  return keyOf(y, m - 1, d);
}

function loadEvents(list) {
  byDate = {};
  let bad = 0;
  for (const ev of list) {
    const k = parseDate(ev.date);
    if (!k) {
      bad++;
      continue;
    }
    (byDate[k] ||= []).push({
      kyosi: ev.kyosi ?? null,
      subj: subjectOf(k, ev.kyosi ?? null),
      title: ev.title ?? "",
      descr: (ev.descr ?? "").trim(),
      prepa: Array.isArray(ev.prepa) ? ev.prepa : [],
      suhang: ev.suhang === true,
    });
  }
  /* 교시 없는 일정(종일) 먼저, 그 다음 교시 순 */
  for (const k in byDate) {
    byDate[k].sort((a, b) => (a.kyosi ?? -1) - (b.kyosi ?? -1));
  }
  return bad;
}

function prepaOf(list) {
  return [...new Set(list.flatMap((e) => e.prepa).filter(Boolean))];
}

function dateLabel(k) {
  const [y, m, d] = k.split("-").map(Number);
  const w = DOW[new Date(y, m - 1, d).getDay()];
  return `${y}.${m}.${d}(${w})`;
}

function itemHTML(e) {
  return `<div class="p-item${e.suhang ? " suhang" : ""}">
    ${e.kyosi !== null ? `<span class="kyosi">${esc(e.kyosi)}교시</span>` : ""}
    ${e.subj ? `<span class="subj">${esc(e.subj)}</span>` : ""}
    <span class="title">${esc(e.title)}</span>
    ${e.descr ? `<span class="descr">${esc(e.descr)}</span>` : ""}
  </div>`;
}

function render() {
  hidePopup(true);
  $("ym").textContent = `${viewY}년 ${viewM + 1}월`;
  const first = new Date(viewY, viewM, 1);
  const start = new Date(viewY, viewM, 1 - first.getDay());
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(viewY, viewM + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + lastDay) / 7);

  let html = "";
  for (let w = 0; w < weeks; w++) {
    html += "<tr>";
    for (let i = 0; i < 7; i++) {
      const dt = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + w * 7 + i,
      );
      const k = keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate());

      //수행모드인 경우 수행이 있는 일정만 표시, 수행모드가 아닌 경우 모든 일정 표시
      // const evs = suhangOnly
      //   ? byDate[k]?.filter((e) => e.suhang) || []
      //   : byDate[k] || [];
      const evs = byDate[k]?.filter((e) => !suhangOnly || e.suhang) || [];

      const hol = suhangOnly ? undefined : HOLIDAYS[k];
      const cls = [
        dt.getMonth() !== viewM ? "other" : "",
        i === 0 ? "sun" : "",
        hol ? "holiday" : "",
        k === todayKey ? "today" : "",
        evs.length || hol ? "has" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const shown = evs
        .slice(0, 3)
        .map(
          (e) =>
            `<div class="ev${e.suhang ? " suhang" : ""}"><span>${esc(e.title)}</span></div>`,
        )
        .join("");
      const more =
        evs.length > 3 ? `<div class="more">+${evs.length - 3}개</div>` : "";
      html += `<td class="${cls}" data-key="${k}" ${evs.length || hol ? 'tabindex="0"' : ""}>
        <div class="num-row"><span class="num">${dt.getDate()}</span>${hol ? `<span class="hname">${esc(hol)}</span>` : ""}</div>
        ${shown}${more}
      </td>`;
    }
    html += "</tr>";
  }
  $("grid").innerHTML = html;
  renderDetail();
}

function renderDetail() {
  $("detailTitle").textContent = `${viewM + 1}월 학사일정 상세 내용`;
  const prefix = `${viewY}-${pad(viewM + 1)}-`;
  const keys = Object.keys(byDate)
    .filter((k) => k.startsWith(prefix))
    .sort();

  if (!keys.length) {
    $("detailList").innerHTML =
      `<div class="empty">이 달에 등록된 일정이 없다.</div>`;
    return;
  }
  $("detailList").innerHTML = keys
    .map((k) => {
      //수행모드인 경우 수행이 있는 일정만 표시, 수행모드가 아닌 경우 모든 일정 표시
      const list = byDate[k].filter((e) => !suhangOnly || e.suhang);
      const pr = !suhangOnly ? prepaOf(list) : [];
      return `<div class="d-day">
      <div class="d-head">${dateLabel(k)}</div>
      <div class="d-body">
        ${pr.length ? `<div class="p-prepa">준비물: ${pr.map(esc).join(", ")}</div>` : ""}
        ${list.map(itemHTML).join("")}
      </div>
    </div>`;
    })
    .join("");
}

/* ---------- 팝업 ---------- */
function showPopup(td) {
  const k = td.dataset.key;
  const list = byDate[k]?.filter((e) => !suhangOnly || e.suhang) || [];
  const hol = !suhangOnly && HOLIDAYS[k];
  if (!list.length && !hol) return;
  const pr = !suhangOnly ? prepaOf(list) : [];
  $("popBody").innerHTML = `
    <div class="p-date">${dateLabel(k)}</div>
    ${hol ? `<div class="p-hol">${esc(hol)}</div>` : ""}
    ${pr.length ? `<div class="p-prepa">준비물: ${pr.map(esc).join(", ")}</div>` : ""}
    <div class="p-list">${list.map(itemHTML).join("")}</div>`;
  const pop = $("popup");
  pop.classList.add("show");

  const area = $("calArea").getBoundingClientRect();
  const r = td.getBoundingClientRect();
  let left = r.left - area.left + 24;
  let top = r.top - area.top + 34;
  const maxLeft = area.width - pop.offsetWidth - 4;
  if (left > maxLeft) left = Math.max(0, maxLeft);
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}

function hidePopup(force) {
  if (pinned && !force) return;
  pinned = false;
  $("popup").classList.remove("show");
}

const grid = $("grid");
grid.addEventListener("mouseover", (e) => {
  if (pinned) return;
  const td = e.target.closest("td.has");
  if (td) showPopup(td);
});
grid.addEventListener("mouseout", (e) => {
  if (pinned) return;
  const to = e.relatedTarget;
  if (
    to &&
    to.closest &&
    (to.closest("#popup") || to.closest("td") === e.target.closest("td"))
  )
    return;
  hidePopup();
});
$("popup").addEventListener("mouseleave", (e) => {
  if (pinned) return;
  const to = e.relatedTarget;
  if (to && to.closest && to.closest("td.has")) return;
  hidePopup();
});
grid.addEventListener("click", (e) => {
  const td = e.target.closest("td.has");
  if (!td) return;
  showPopup(td);
  pinned = true;
});
grid.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("td.has")) {
    e.preventDefault();
    showPopup(e.target);
    pinned = true;
  }
});
$("popClose").addEventListener("click", () => hidePopup(true));
document.addEventListener("click", (e) => {
  if (!e.target.closest("#popup") && !e.target.closest("td.has"))
    hidePopup(true);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hidePopup(true);
});

/* ---------- 네비게이션 ---------- */
$("prev").onclick = () => {
  viewM--;
  if (viewM < 0) {
    viewM = 11;
    viewY--;
  }
  render();
};
$("next").onclick = () => {
  viewM++;
  if (viewM > 11) {
    viewM = 0;
    viewY++;
  }
  render();
};
$("today").onclick = () => {
  now = new Date();
  viewY = now.getFullYear();
  viewM = now.getMonth();
  render();
};

// 수행만 보기 모드 체크박스
$("perform").onclick = (e) => {
  suhangOnly = e.target.checked;
  render();
};

/* ---------- 시작: 같은 폴더의 database.csv 우선, 없으면 기본 데이터 ---------- */
(async function init() {
  let data = null;
  try {
    const res = await fetch("database.csv", { cache: "no-store" });
    if (res.ok) data = csvToEvents(await res.text());
  } catch (err) {
    console.error("database.csv 읽기 실패:", err);
  }
  if (data) {
    const bad = loadEvents(data);
    $("status").innerHTML =
      `<u><a class="link" href="https://youtu.be/dQw4w9WgXcQ">10320作</a></u>`;
  } else {
    loadEvents(FALLBACK_EVENTS);
    $("status").textContent = "database.csv를 찾지 못해 빈 일정으로 시작함";
  }
  render();
})();
