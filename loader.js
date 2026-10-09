/* ---------- CSV 파싱 (RFC 4180: 따옴표, "" 이스케이프, 칸 안 줄바꿈, CRLF, BOM 처리) ---------- */
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, ""); // 엑셀 UTF-8 BOM 제거
  const rows = [];
  let row = [],
    field = "",
    inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== "")); // 빈 줄 제거
}

/* CSV 텍스트 → 기존 JSON과 같은 형태의 이벤트 배열 */
export function csvToEvents(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name) => head.indexOf(name);
  const miss = ["date", "title"].filter((n) => col(n) < 0);
  if (miss.length) throw new Error(`헤더에 ${miss.join(", ")} 열이 없다`);

  return rows.slice(1).map((r) => {
    const get = (n) => (col(n) < 0 ? "" : (r[col(n)] ?? "").trim());
    const k = get("kyosi");
    return {
      date: get("date"),
      kyosi: k !== "" && Number.isFinite(Number(k)) ? Number(k) : null,
      title: get("title"),
      descr: get("descr").replace(/\\n/g, "\n"),
      prepa: get("prepa")
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });
}
