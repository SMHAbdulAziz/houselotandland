/* Deal Advisor: a chat with Claude about one deal, shared by the Deal Desk, Sub-To Pipeline and Creative Finance Tracker.
   Inlined into each dashboard (claude.ai artifacts). Runs on the viewer's Claude plan through the `sample` capability
   (images declared). Claude sees the deal, the dashboard's own numbers, the property's other tracks in the back office,
   the saved conversation and anything attached (photos, screenshots, PDFs, text/CSV/email files). It never changes
   anything by itself: proposed changes come back in a ```hll-actions block and wait for Harvey's click.
   The conversation is saved per record in the dashboard's db at advisor/<record id>.
   Deep link from the back office: <artifact url>#advise-<hub deal id with "_" as "-">  (e.g. #advise-d-2cmis2zb5nyi).
   Source of truth: houselotandland repo, src/dashboards/advisor.js. Keep the three dashboards' copies identical. */
window.DealAdvisor = (function(){
  "use strict";
  const DB_ID = "41cd2c24-fb52-41ae-95b9-748ee75b2d31", CF = "Cloudflare Developer Platform";
  const MODEL = "claude-opus-5-5";
  const TRACKS = {
    wholesale: {label:"Wholesale (Deal Desk)", stages:["Lead","Analyzing","Offer sent","Under contract","Marketing","Assigned","Closed","Dead"]},
    subto: {label:"Sub-To (take over the existing loan)", stages:["New","Contacted","Appointment","Offer sent","Under contract","Closed","Dead"]},
    creative: {label:"Creative finance (seller financing, JV, terms)", stages:["New lead","Contacted","Terms requested","Underwriting","Offer out","Under contract","Closed","Dead"]},
  };
  const MAX_TURNS = 24, MAX_STORED = 9000, MAX_FILE_TEXT = 16000;
  // Harvey's market value: FMV = county appraisal-district value ÷ 0.8. Shown beside BatchData's Est. value, never instead of it (same as fmvFromAppraised in js/hub-keys.js).
  const FMV_RATIO = 0.8;
  const fmv = v => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return n > 0 ? Math.round(n / FMV_RATIO) : null; };
  // Save a county appraised value (and its FMV) on the master-list property, so the back office and the other dashboards see it.
  async function saveAppraised(mcp, hubPid, value, source){
    const v = Number(String(value ?? "").replace(/[$,\s]/g, ""));
    if(!mcp || !hubPid || !(v > 0)) return false;
    await mcp.callTool(CF, "d1_database_query", {database_id:DB_ID, params:[String(v), String(fmv(v)), String(source || "BatchData"), new Date().toISOString(), hubPid],
      sql:"UPDATE properties SET data = json_set(COALESCE(data, '{}'), '$.appraisedValue', CAST(? AS REAL), '$.fmv', CAST(? AS REAL), '$.appraisedSource', ?), updated_at = ? WHERE id = ?"});
    return true;
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };

  const RULES = (cfg) => `You are the Deal Advisor inside House Lot & Land Sales Co. LLC's ${cfg.appLabel}. You work for Harvey Searcy, the owner (Dallas-Fort Worth, Texas; buys nationwide). He is the principal and decides; you advise him like a sharp, frugal real estate investor and acquisitions manager who knows his business.

THE BUSINESS
- Tracks (exit strategies) in his system:
  • wholesale: put the property under contract below value and assign it to a cash buyer for a fee (Deal Desk; default fee about $15,000, minimum about $7,500; cash offers start near 70% of ARV minus repairs and fee). Offer options he uses: assignable cash offer, option to purchase, seller-finance terms. He prefers the option with the least cash out of his pocket. On land or 3+ acre deals he likes keeping some acreage free.
  • subto: buy "subject to" the existing mortgage: take over the seller's payments, keep the loan in place, then rent and hold, JV rent-hold, or assign. Needs a below-market or workable loan, PITI the rent can cover, equity or a motivated seller (pre-foreclosure, probate/inherited, tired landlord, expired listing). Due-on-sale risk is managed with reserves.
  • creative: seller financing / terms / JV / partnerships, mostly income property (RV parks, mobile home parks, storage, apartments) but any property where terms beat cash.
  • pass: not worth pursuing.
- Partnering: when another investor or wholesaler brings a deal, find out whether they own it or control it (assignable contract, price, closing date), and consider a JV or double close instead of paying retail.
- Rules he never breaks: closed for all new business from sunset Friday to sunset Saturday (Shabbat); never call or text anyone without recorded consent (texts only through his bridge); offers and agreements go out only by his click; never collect SSNs, tax IDs or bank/account numbers; no legal or tax advice (say when an attorney, title company or CPA should confirm); in Texas the wholesaler disclosure (Occupations Code §1101.0045) applies to assigned contracts; buyer entity: "House Lot & Land Sales Co. LLC, a Texas-based limited liability company". He is frugal: flag anything that costs money (data credits, inspections, travel) and suggest the cheapest way to learn the same thing.

HOW TO ANSWER
- Lead with the answer: recommended track and exit, in one or two sentences, then why, with the numbers worked out (show the arithmetic briefly). Then risks and red flags, then the questions to ask or documents to get next. Be direct and specific; no filler. Use short headings and bullets; tables only for comparisons.
- Values: "Est. value" is BatchData's automated estimate. Harvey also uses his own market value, FMV = county appraisal-district value ÷ 0.8 (shown as fmv / appraisedValue with the deal). Report FMV beside Est. value whenever the appraised value is known, never in place of it, and say which one each calculation uses (the dashboard's own math uses Est. value / ARV). If a screenshot or document shows the county appraised (market) value, propose it as the "appraised" update so FMV is computed.
- Compare data sources: public records/BatchData vs. what a seller, agent or investor claims vs. photos/documents. Point out every mismatch (beds, baths, square feet, owner name, liens, listing status, price) and what it might mean (unpermitted addition, outdated records, wrong owner, middleman).
- When images are attached, say briefly what you see that matters (condition, repairs, rooms, roof, foundation clues, the text in a screenshot), because later turns will not include the images again.
- Reference code: every deal has one (shown as REFERENCE CODE with the deal, like HL-SMEGG). Every email, letter or text you draft about this property must carry it exactly as given: in an email subject as "(Ref HL-XXXXX)" after the property address and again on its own line above the signature as "Reference: HL-XXXXX"; in a text as "Ref HL-XXXXX". Spanish: "(Ref HL-XXXXX)" and "Referencia: HL-XXXXX". Never make up or change a code.
- Never invent facts or comps. If you are estimating, say so. If information is missing, say what is missing and how to get it.
- Today is ${today()}.

PROPOSING CHANGES
If the deal record should change (corrected property facts, numbers, notes, stage, next follow-up date, or adding the property to another track), end your reply with ONE fenced block exactly like this, and only include what should change:
\`\`\`hll-actions
{"updates": {"<field>": <value>}, "note": "<one or two lines to add to the deal notes>", "stage": "<stage>", "nextTouch": "YYYY-MM-DD", "addTrack": "<track>", "why": "<one short sentence>"}
\`\`\`
- "updates" keys must come from this list (use numbers for numeric fields): ${cfg.fields.map(f => f.key + (f.type === "number" ? " (number)" : f.type === "date" ? " (YYYY-MM-DD)" : f.options ? " (one of: " + f.options.join(" | ") + ")" : "")).join(", ")}.
- "stage" must be one of: ${(cfg.stages || []).join(" | ")}.
- "addTrack" may be "wholesale", "subto" or "creative" (not this dashboard's own track, "${cfg.track}"); it adds the property to that track in the back office so it appears on that dashboard too.
- Harvey reviews each change and clicks Apply; nothing changes until he does. Do not mention the block in your prose beyond "I've proposed updates below." Leave the block out when nothing should change.`;

  /* ---------- tiny Markdown renderer (escaped first) ---------- */
  function inline(s){
    return s.replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src){
    const lines = esc(src).split("\n"), out = []; let list = null, table = null, para = [];
    const flushP = () => { if(para.length){ out.push("<p>" + inline(para.join("<br>")) + "</p>"); para = []; } };
    const flushL = () => { if(list){ out.push(`<${list.t}>` + list.items.map(i => "<li>" + inline(i) + "</li>").join("") + `</${list.t}>`); list = null; } };
    const flushT = () => { if(table){ const rows = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\s*\||\|\s*$/g, "").split("|").map(c => inline(c.trim())));
      if(rows.length) out.push('<div class="da-tw"><table><thead><tr>' + rows[0].map(c => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>" + rows.slice(1).map(r => "<tr>" + r.map(c => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
      table = null; } };
    for(const raw of lines){
      const l = raw.replace(/\s+$/, "");
      if(/^\s*\|.*\|\s*$/.test(l)){ flushP(); flushL(); (table = table || []).push(l); continue; } else flushT();
      let m;
      if(!l.trim()){ flushP(); flushL(); continue; }
      if((m = l.match(/^(#{1,4})\s+(.*)$/))){ flushP(); flushL(); out.push(`<h4>${inline(m[2])}</h4>`); continue; }
      if((m = l.match(/^\s*[-*•]\s+(.*)$/))){ flushP(); if(!list || list.t !== "ul"){ flushL(); list = {t:"ul", items:[]}; } list.items.push(m[1]); continue; }
      if((m = l.match(/^\s*\d+[.)]\s+(.*)$/))){ flushP(); if(!list || list.t !== "ol"){ flushL(); list = {t:"ol", items:[]}; } list.items.push(m[1]); continue; }
      if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)){ flushP(); flushL(); out.push("<hr>"); continue; }
      if(list && /^\s{2,}\S/.test(l)){ list.items[list.items.length-1] += " " + l.trim(); continue; }
      flushL(); para.push(l);
    }
    flushP(); flushL(); flushT();
    return out.join("");
  }
  // Split a reply into prose and the actions block (also hides a half-written block while streaming).
  function splitReply(text){
    const i = text.indexOf("```hll-actions");
    if(i < 0) return {prose:text, actions:null};
    const prose = text.slice(0, i).trimEnd(), rest = text.slice(i + 14), j = rest.indexOf("```");
    if(j < 0) return {prose, actions:null, partial:true};
    let actions = null; try{ actions = JSON.parse(rest.slice(0, j).trim()); }catch(_){ actions = null; }
    const after = rest.slice(j + 3).trim();
    return {prose: after ? prose + "\n\n" + after : prose, actions};
  }

  /* ---------- files ---------- */
  let pdfjs = null;
  function loadPdfJs(){
    if(pdfjs) return pdfjs;
    pdfjs = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => { const lib = window.pdfjsLib; if(!lib) return rej(new Error("pdf")); lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(lib); };
      s.onerror = () => { pdfjs = null; rej(new Error("pdf")); };
      document.head.appendChild(s);
    });
    return pdfjs;
  }
  async function readPdf(file, wantPages){
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({data: new Uint8Array(file._buf ? file._buf.slice(0) : await file.arrayBuffer()), isEvalSupported:false}).promise;
    let text = "";
    for(let p = 1; p <= Math.min(doc.numPages, 40) && text.length < MAX_FILE_TEXT; p++){
      const pg = await doc.getPage(p); const tc = await pg.getTextContent();
      text += `\n[page ${p}]\n` + tc.items.map(i => i.str + (i.hasEOL ? "\n" : " ")).join("");
    }
    const images = [];
    for(let p = 1; p <= Math.min(doc.numPages, wantPages); p++){
      const pg = await doc.getPage(p); const vp = pg.getViewport({scale:1}); const scale = Math.min(2, 1400 / Math.max(vp.width, vp.height));
      const v2 = pg.getViewport({scale}); const c = document.createElement("canvas"); c.width = v2.width; c.height = v2.height;
      await pg.render({canvasContext:c.getContext("2d"), viewport:v2}).promise;
      const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85)); if(b) images.push(new File([b], `${file.name} p${p}.jpg`, {type:"image/jpeg"}));
    }
    return {text: text.trim(), pages: doc.numPages, images};
  }
  const TEXT_RE = /\.(txt|csv|tsv|md|json|eml|html?|xml|rtf|log)$/i;

  /* ---------- styles ---------- */
  const CSS = `
.da-root{--da-bg:#fff;--da-ink:#151b26;--da-muted:#5a6577;--da-line:#d6dce5;--da-acc:#2b4c7e;--da-acc-ink:#fff;--da-soft:#e8eef7;--da-me:#2b4c7e;--da-me-ink:#fff;--da-ok:#1e7a46;--da-warn:#9a5b00;
  font:14.5px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--da-ink)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .da-root{--da-bg:#171d27;--da-ink:#e5eaf2;--da-muted:#98a3b5;--da-line:#2a3342;--da-acc:#86a8dc;--da-acc-ink:#0e1420;--da-soft:#1e2a3d;--da-me:#2f4b75;--da-me-ink:#fff;--da-ok:#5cc58a;--da-warn:#e2a64a}}
:root[data-theme="dark"] .da-root{--da-bg:#171d27;--da-ink:#e5eaf2;--da-muted:#98a3b5;--da-line:#2a3342;--da-acc:#86a8dc;--da-acc-ink:#0e1420;--da-soft:#1e2a3d;--da-me:#2f4b75;--da-me-ink:#fff;--da-ok:#5cc58a;--da-warn:#e2a64a}
.da-fab{position:fixed;right:18px;bottom:18px;z-index:9000;border:0;border-radius:999px;padding:12px 18px;background:var(--da-acc);color:var(--da-acc-ink);font:600 14.5px/1 system-ui,sans-serif;box-shadow:0 8px 24px -8px rgba(0,0,0,.45);cursor:pointer}
.da-fab[hidden]{display:none}
.da-panel{position:fixed;top:0;right:0;bottom:0;width:min(480px,100vw);z-index:9001;background:var(--da-bg);border-left:1px solid var(--da-line);box-shadow:-12px 0 32px -16px rgba(0,0,0,.4);display:flex;flex-direction:column}
.da-panel[hidden]{display:none}
/* Side by side: on screens 900px and wider the open panel docks on the right and the dashboard narrows beside it (html.da-docked).
   Phones keep the panel over the page. Dashboards keep their own pop-ups in the narrowed area with html.da-docked rules. */
:root{--da-w:clamp(360px,34vw,520px)}
@media (min-width:900px){html.da-docked body{margin-right:var(--da-w)!important}html.da-docked .da-panel{width:var(--da-w);box-shadow:none}}
.da-root *,.da-root *::before,.da-root *::after{box-sizing:border-box}
.da-root button,.da-root textarea{font:inherit;letter-spacing:normal;text-transform:none;margin:0;box-shadow:none;width:auto;min-height:0;height:auto}
.da-head{flex:none;display:flex;align-items:flex-start;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--da-line)}
.da-head .da-t{flex:1;min-width:0}.da-head b{display:block;font-size:16px}.da-head small{display:block;color:var(--da-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.da-root .da-btn{display:inline-block;line-height:1.3;border:1px solid var(--da-line);background:transparent;color:var(--da-ink);border-radius:9px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer}
.da-root .da-btn:hover{background:var(--da-soft)}.da-root .da-btn.pri{background:var(--da-acc);color:var(--da-acc-ink);border-color:var(--da-acc)}.da-btn:disabled{opacity:.55;cursor:default}
.da-x{border:0;background:transparent;color:var(--da-muted);font-size:22px;line-height:1;cursor:pointer;padding:2px 4px}
.da-log{flex:1 1 auto;min-height:0;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.da-msg{max-width:100%;overflow-wrap:anywhere}.da-msg.me{align-self:flex-end;max-width:88%;background:var(--da-me);color:var(--da-me-ink);border-radius:14px 14px 4px 14px;padding:8px 12px;white-space:pre-wrap}
.da-msg.ai{border-left:3px solid var(--da-acc);padding:2px 0 2px 12px}.da-msg.ai p{margin:.35em 0}.da-msg.ai h4{margin:.8em 0 .3em;font-size:14.5px}.da-msg.ai ul,.da-msg.ai ol{margin:.3em 0;padding-left:1.3em}.da-msg.ai code{background:var(--da-soft);border-radius:4px;padding:0 4px}
.da-msg.sys{align-self:center;color:var(--da-muted);font-size:12.5px;text-align:center}
.da-files{font-size:12px;opacity:.85;margin-top:4px}
.da-tw{overflow:auto;max-width:100%}.da-root .da-msg table{width:auto;min-width:0;max-width:none;table-layout:auto;border-collapse:collapse;font-size:13px;margin:.4em 0;background:none}.da-root .da-msg th,.da-root .da-msg td{border:1px solid var(--da-line);padding:4px 7px;text-align:left;vertical-align:top;white-space:normal;font:inherit;font-size:13px;letter-spacing:normal;text-transform:none;color:var(--da-ink);background:none;position:static}.da-root .da-msg th{font-weight:600}
.da-think{color:var(--da-muted);font-style:italic}
.da-act{border:1px solid var(--da-line);border-radius:12px;padding:10px 12px;background:var(--da-soft)}
.da-act h5{margin:0 0 6px;font-size:13.5px}.da-act label{display:flex;font-weight:400;color:var(--da-ink);gap:8px;align-items:flex-start;font-size:13.5px;margin:4px 0}.da-act input{margin-top:3px;width:auto;flex:none}
.da-act .da-why{color:var(--da-muted);font-size:12.5px;margin:0 0 6px}.da-act .da-row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.da-act .da-done{color:var(--da-ok);font-size:13px}
.da-chips{flex:none;display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 8px}.da-chip{border:1px solid var(--da-line);border-radius:999px;padding:4px 10px;background:transparent;color:var(--da-ink);font-size:12.5px;cursor:pointer}.da-chip:hover{background:var(--da-soft)}
.da-comp{flex:none;margin:0;display:block;border-top:1px solid var(--da-line);padding:10px 16px 14px}
.da-att{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.da-att span{display:inline-flex;gap:6px;align-items:center;font-size:12px;border:1px solid var(--da-line);border-radius:8px;padding:3px 6px}.da-att button{border:0;background:none;color:var(--da-muted);cursor:pointer;padding:0}
.da-root .da-comp textarea{display:block;width:100%;min-height:64px;height:64px;max-height:200px;resize:vertical;border:1px solid var(--da-line);border-radius:10px;padding:8px 10px;background:transparent;color:var(--da-ink);font:inherit}
.da-comp .da-bar{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.da-comp .da-bar .da-sp{flex:1}.da-comp .da-note{font-size:12px;color:var(--da-muted)}
.da-drop{outline:2px dashed var(--da-acc);outline-offset:-8px}
.da-err{color:var(--da-warn);font-size:13px}
@media (max-width:560px){.da-fab{right:12px;bottom:12px;padding:11px 15px}}`;

  function mount(cfg){
    if(!document.getElementById("da-style")){ const st = document.createElement("style"); st.id = "da-style"; st.textContent = CSS; document.head.appendChild(st); }
    const root = document.createElement("div"); root.className = "da-root";
    root.innerHTML = `<button class="da-fab" type="button">✦ Deal Advisor</button>
      <aside class="da-panel" hidden aria-label="Deal Advisor">
        <div class="da-head"><div class="da-t"><b>Deal Advisor</b><small class="da-sub">Pick a deal to start</small></div>
          <button class="da-btn da-new" type="button" title="Start a new conversation on this deal">New chat</button><button class="da-x" type="button" aria-label="Close">×</button></div>
        <div class="da-log" aria-live="polite"></div>
        <div class="da-chips"></div>
        <form class="da-comp"><div class="da-att"></div>
          <textarea placeholder="Ask about this deal, paste an email or numbers, or drop photos, screenshots and PDFs…"></textarea>
          <div class="da-bar"><button class="da-btn da-file" type="button">📎 Attach</button><input type="file" multiple hidden accept="image/*,.pdf,.txt,.csv,.tsv,.md,.json,.eml,.html,.htm,.xml">
            <span class="da-sp da-note"></span><button class="da-btn da-stop" type="button" hidden>Stop</button><button class="da-btn pri da-send" type="submit">Send</button></div></form>
      </aside>`;
    document.body.appendChild(root);
    const q = s => root.querySelector(s);
    const fab = q(".da-fab"), panel = q(".da-panel"), log = q(".da-log"), sub = q(".da-sub"), chips = q(".da-chips"), form = q(".da-comp"), ta = q("textarea"),
      fileIn = q("input[type=file]"), attBox = q(".da-att"), note = q(".da-comp .da-note"), sendBtn = q(".da-send"), stopBtn = q(".da-stop");
    const S = {recId:null, turns:[], files:[], busy:false, ctl:null, sample:null, limits:null, loadedFor:null, mcp:null};

    const CHIPS = [
      ["Best track & exit", "What's the best track and exit strategy for this deal, and what would you offer? Work the numbers."],
      ["Check the data", "Compare everything we know about this property (public records, what the seller/agent/investor said, the listing) and flag every mismatch and what it means."],
      ["What to ask next", "What questions should I ask, and what documents should I get, before making an offer?"],
      ["Draft a reply", "Draft my reply to the latest message from the seller or the person who sent this deal. Keep it short, in my voice, with the reference code."],
    ];
    chips.innerHTML = CHIPS.map(([l], i) => `<button type="button" class="da-chip" data-i="${i}">${esc(l)}</button>`).join("");

    async function getSample(){
      if(S.sample) return S.sample;
      try{ S.sample = await window.claude.use("sample"); }catch(_){ S.sample = null; }
      if(S.sample && !S.limits){ try{ S.limits = await S.sample.limits(); }catch(_){ S.limits = null; } }
      return S.sample;
    }
    async function getMcp(){ if(S.mcp) return S.mcp; try{ S.mcp = cfg.getMcp ? await cfg.getMcp() : await window.claude.use("mcp"); }catch(_){ S.mcp = null; } return S.mcp; }
    const rowsOf = r => { let p = r && r.payload; if(typeof p === "string"){ try{ p = JSON.parse(p); }catch(_){ return []; } }
      const a = Array.isArray(p) ? p : (p && (p.result || p.results)) || []; if(Array.isArray(a) && a[0] && Array.isArray(a[0].results)) return a[0].results;
      return Array.isArray(a) ? a.filter(x => x && typeof x === "object" && !("success" in x && "meta" in x)) : []; };
    async function d1(sql, params){ const m = await getMcp(); if(!m) throw new Error("The back office connection isn't available in this view.");
      return rowsOf(await m.callTool(CF, "d1_database_query", {database_id:DB_ID, sql, params:(params || []).map(v => v == null ? "" : String(v))})); }
    const db = () => cfg.getDb && cfg.getDb();

    /* ----- conversation storage ----- */
    async function loadThread(id){
      S.turns = []; const d = db(); if(!d) return;
      try{ const s = await d.doc("advisor/" + id).get(); if(s.exists){ const v = s.data(); S.turns = Array.isArray(v.turns) ? v.turns : []; } }catch(_){}
    }
    let saving = Promise.resolve();
    function saveThread(){
      const d = db(), id = S.recId; if(!d || !id) return;
      const turns = S.turns.slice(-MAX_TURNS * 2).map(t => ({...t, content: String(t.content || "").slice(0, MAX_STORED)}));
      saving = saving.then(() => d.doc("advisor/" + id).set({turns, updatedAt:new Date().toISOString(), app:cfg.app})).catch(() => {});
    }

    /* ----- rendering ----- */
    function actionCard(t, idx){
      const a = t.actions; if(!a || typeof a !== "object") return "";
      const rec = cfg.current(), items = [];
      const fields = Object.fromEntries(cfg.fields.map(f => [f.key, f]));
      const curVal = k => { const v = cfg.getField ? cfg.getField(k) : rec && rec.data && rec.data[k]; return v == null || v === "" ? "—" : String(v); };
      if(a.updates && typeof a.updates === "object") for(const [k0, v] of Object.entries(a.updates)){
        const k = fields[k0] ? k0 : fields["inputs." + k0] ? "inputs." + k0 : null; // accept analyzer inputs named without the prefix
        if(k && v != null && String(v) !== "") items.push({kind:"u", k, v, label:`${fields[k].label}: ${curVal(k)} → ${v}`}); }
      if(a.stage && (cfg.stages || []).includes(a.stage)) items.push({kind:"stage", v:a.stage, label:`Stage → ${a.stage}`});
      if(a.nextTouch && /^\d{4}-\d{2}-\d{2}$/.test(a.nextTouch) && cfg.nextKey) items.push({kind:"next", v:a.nextTouch, label:`Next follow-up → ${a.nextTouch}`});
      if(a.note && cfg.notesKey) items.push({kind:"note", v:String(a.note).slice(0, 1500), label:`Add to notes: “${String(a.note).slice(0, 300)}${String(a.note).length > 300 ? "…" : ""}”`});
      if(a.addTrack && TRACKS[a.addTrack] && a.addTrack !== cfg.track) items.push({kind:"track", v:a.addTrack, label:`Add this property to the ${TRACKS[a.addTrack].label.split(" (")[0]} track (back office and that dashboard)`});
      if(!items.length) return "";
      t._items = items;
      if(t.applied) return `<div class="da-act"><h5>Proposed changes</h5><p class="da-done">✓ ${esc(t.applied)}</p></div>`;
      return `<div class="da-act" data-idx="${idx}"><h5>Proposed changes</h5>${a.why ? `<p class="da-why">${esc(a.why)}</p>` : ""}
        ${items.map((it, j) => `<label><input type="checkbox" data-j="${j}" checked> <span>${esc(it.label)}</span></label>`).join("")}
        <div class="da-row"><button type="button" class="da-btn pri da-apply">Apply selected</button><button type="button" class="da-btn da-skip">Dismiss</button><span class="da-err"></span></div></div>`;
    }
    function render(streamText){
      const rec = cfg.current();
      sub.textContent = rec ? rec.title : "Pick a deal on this dashboard to start";
      const parts = [];
      if(!S.turns.length && !streamText) parts.push(`<div class="da-msg sys">${rec ? "Ask anything about this deal. I can see its details and numbers; attach photos, screenshots, PDFs or paste emails for me to weigh in. I'll propose changes for you to approve." : "Open a deal, then ask me about it."}</div>`);
      S.turns.forEach((t, i) => {
        if(t.hidden) return;
        if(t.role === "user") parts.push(`<div class="da-msg me">${esc(t.display || t.content)}${t.files && t.files.length ? `<div class="da-files">📎 ${esc(t.files.join(", "))}</div>` : ""}</div>`);
        else if(t.role === "assistant") parts.push(`<div class="da-msg ai">${md(splitReply(t.content).prose)}</div>${actionCard(t, i)}`);
        else if(t.role === "note") parts.push(`<div class="da-msg sys">${esc(t.content)}</div>`);
      });
      if(streamText != null) parts.push(`<div class="da-msg ai">${streamText ? md(splitReply(streamText).prose) : `<span class="da-think">Thinking…</span>`}</div>`);
      log.innerHTML = parts.join("");
      log.scrollTop = log.scrollHeight;
      const can = !!rec && !S.busy;
      sendBtn.disabled = !can; ta.disabled = !rec; q(".da-file").disabled = !can; q(".da-new").disabled = !rec || S.busy || !S.turns.length;
      chips.hidden = !rec || S.busy;
      sendBtn.hidden = S.busy; stopBtn.hidden = !S.busy;
    }
    function renderFiles(){
      attBox.innerHTML = S.files.map((f, i) => `<span>${/^image\//.test(f.type) ? "🖼" : /pdf$/i.test(f.name) ? "📄" : "📝"} ${esc(f.name)} <button type="button" data-rm="${i}" aria-label="Remove">×</button></span>`).join("");
      const im = S.limits && S.limits.images;
      note.textContent = S.files.length ? `${S.files.length} file${S.files.length > 1 ? "s" : ""} attached` : im ? "Photos, screenshots, PDFs, text and CSV files" : "PDFs, text and CSV files";
    }
    function addFiles(list){
      const im = S.limits && S.limits.images;
      for(const f of Array.from(list || [])){
        const isImg = /^image\//.test(f.type), isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name), isText = /^text\//.test(f.type) || /json|xml|message\/rfc822/.test(f.type) || TEXT_RE.test(f.name);
        if(isImg && !im){ toast("Photos can't be sent from this view. Open the dashboard in claude.ai."); continue; }
        if(isImg && im && im.mediaTypes && !im.mediaTypes.includes(f.type)){ toast(`${f.name}: use JPG, PNG, WebP or GIF.`); continue; }
        if(!isImg && !isPdf && !isText){ toast(`${f.name}: I can read photos, PDFs, and text, CSV or email files. Save spreadsheets as CSV.`); continue; }
        if(f.size > 25 * 1024 * 1024){ toast(`${f.name} is too large (25 MB max).`); continue; }
        if(S.files.length >= 12){ toast("Up to 12 files at a time."); break; }
        S.files.push(f); f._reading = readNow(f);
      }
      renderFiles();
    }
    // Read the file's bytes as soon as it's attached (10-second limit). A file the computer can't hand over (for example
    // one stored in iCloud or Google Drive that isn't downloaded) is dropped with a message, instead of freezing Send later.
    const limit = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
    async function readNow(f){
      try{ f._buf = await limit(f.arrayBuffer(), 10000); }
      catch(_){ const i = S.files.indexOf(f); if(i >= 0) S.files.splice(i, 1); renderFiles();
        note.textContent = `Couldn't open ${f.name}. If it's in iCloud or Google Drive, download it to your computer first, or paste its text instead.`; }
    }
    const toast = msg => { if(cfg.toast) cfg.toast(msg); else note.textContent = msg; };

    /* ----- open / select ----- */
    async function open(id){
      panel.hidden = false; fab.hidden = true; document.documentElement.classList.add("da-docked");
      if(id && cfg.select && (!cfg.current() || cfg.current().id !== id)) cfg.select(id);
      await sync();
      getSample().then(renderFiles);
      setTimeout(() => ta.focus({preventScroll:true}), 50);
    }
    async function sync(){
      const rec = cfg.current(), id = rec ? rec.id : null;
      if(id !== S.recId){
        if(S.busy && S.ctl) S.ctl.abort();
        S.recId = id; S.turns = []; S.files = []; renderFiles(); render();
        if(id){ await loadThread(id); if(S.recId === id) render(); }
      } else render();
    }
    function close(){ panel.hidden = true; fab.hidden = false; document.documentElement.classList.remove("da-docked"); }
    fab.onclick = () => open();
    q(".da-x").onclick = close;
    q(".da-new").onclick = () => { if(S.busy) return; S.turns = []; saveThread(); render(); };
    q(".da-file").onclick = () => fileIn.click();
    fileIn.onchange = () => { addFiles(fileIn.files); fileIn.value = ""; };
    attBox.onclick = e => { const b = e.target.closest("[data-rm]"); if(b){ S.files.splice(+b.dataset.rm, 1); renderFiles(); } };
    ta.addEventListener("paste", e => { const fs = Array.from(e.clipboardData && e.clipboardData.files || []); if(fs.length){ e.preventDefault(); addFiles(fs); } });
    ta.addEventListener("keydown", e => { if(e.key === "Enter" && (e.metaKey || e.ctrlKey)){ e.preventDefault(); form.requestSubmit(); } });
    panel.addEventListener("dragover", e => { if(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")){ e.preventDefault(); panel.classList.add("da-drop"); } });
    panel.addEventListener("dragleave", e => { if(e.target === panel) panel.classList.remove("da-drop"); });
    panel.addEventListener("drop", e => { e.preventDefault(); panel.classList.remove("da-drop"); addFiles(e.dataTransfer.files); });
    chips.onclick = e => { const b = e.target.closest("[data-i]"); if(!b) return; ta.value = CHIPS[+b.dataset.i][1]; form.requestSubmit(); };
    stopBtn.onclick = () => { if(S.ctl) S.ctl.abort(); };

    /* ----- reference code: the dashboard's own (Deal Desk), else one already on the property in the back office, else a stable
       code made from the property id (same algorithm as the Deal Desk's makeRef), saved to the hub deal so every draft reuses it ----- */
    const RA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const makeRef = id => { let h = 2166136261; for(const ch of String(id)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } h >>>= 0; let r = ""; for(let i = 0; i < 5; i++){ r += RA[h % RA.length]; h = Math.floor(h / RA.length); } return "HL-" + r; };
    const REF_OK = /^HL-[A-HJ-NP-Z2-9]{5}$/i, refCache = {};
    async function refFor(rec, ids){
      if(refCache[rec.id]) return refCache[rec.id];
      let ref = cfg.ownRef ? cfg.ownRef(rec.id) : null;
      try{
        if(ids && ids.hubPid){
          if(!ref){ const rows = await d1(`SELECT ref FROM deals WHERE property_id = ? AND ref LIKE 'HL-%' ORDER BY CASE track WHEN 'wholesale' THEN 0 ELSE 1 END, created_at LIMIT 1`, [ids.hubPid]);
            ref = rows[0] && REF_OK.test(rows[0].ref) ? rows[0].ref.toUpperCase() : makeRef(ids.hubPid); }
          if(ids.hubId) await d1(`UPDATE deals SET ref = ? WHERE id = ? AND (ref IS NULL OR ref = '')`, [ref, ids.hubId]);
        }
      }catch(_){}
      ref = ref || makeRef(rec.id);
      return (refCache[rec.id] = ref);
    }

    /* ----- context for Claude ----- */
    async function contextText(rec){
      let ctx = "";
      try{ ctx = JSON.stringify(cfg.context(rec.id), (k, v) => typeof v === "string" && v.length > 4000 ? v.slice(0, 4000) + "…" : v, 1); }catch(_){ ctx = "{}"; }
      if(ctx.length > 30000) ctx = ctx.slice(0, 30000) + "…";
      let hub = "", ids = null;
      try{ ids = cfg.hubIds ? await cfg.hubIds(rec.id) : null; }catch(_){}
      const ref = await refFor(rec, ids);
      try{
        if(ids && ids.hubPid){
          const rows = await d1(`SELECT d.track, d.stage, d.next_touch, d.asking, d.updated_at, c.name AS contact, c.consent, c.opt_out
            FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id WHERE d.property_id = ?`, [ids.hubPid]);
          const acts = await d1(`SELECT at, kind, summary FROM activities WHERE property_id = ? ORDER BY at DESC LIMIT 12`, [ids.hubPid]);
          hub = `\n\nBACK OFFICE (master list) for this property:\nTracks: ${rows.map(r => `${r.track} (${r.stage}${r.next_touch ? ", next touch " + r.next_touch : ""}${r.contact ? ", contact " + r.contact + (r.opt_out == 1 ? " OPTED OUT" : r.consent == 1 ? " (text consent on file)" : " (no text consent)") : ""})`).join("; ") || "none"}\nRecent activity:\n${acts.map(a => `- ${String(a.at).slice(0,10)} ${a.kind}: ${a.summary}`).join("\n") || "- none"}`;
        } else hub = "\n\nBACK OFFICE: this record isn't linked to the master list yet (it links on the next back office sync).";
      }catch(_){ hub = ""; }
      return `REFERENCE CODE for this property: ${ref}\n\nCURRENT DEAL on the ${cfg.appLabel} (record id ${rec.id}):\n${ctx}${hub}`;
    }

    /* ----- send ----- */
    form.onsubmit = async e => {
      e.preventDefault();
      // Send never fails silently: every early exit says why.
      const rec = cfg.current();
      if(!rec){ toast("Pick a deal on this dashboard first, then ask about it."); return; }
      if(S.busy){ note.textContent = "Still working on the last answer. Press Stop to cancel it."; return; }
      const text = ta.value.trim(); if(!text && !S.files.length){ ta.focus(); note.textContent = "Type a question or attach a file."; return; }
      note.textContent = "Connecting to Claude…"; sendBtn.disabled = true;
      let sample = null;
      try{ sample = await getSample(); }finally{ sendBtn.disabled = false; note.textContent = ""; }
      if(!sample){ S.sample = null; toast("Claude isn't available to this dashboard right now. Reload the page, and allow Claude if claude.ai asks."); return; }
      S.busy = true;
      const ctl = S.ctl = new AbortController();
      let shown = "", timedOut = false;
      // If Claude never starts answering, stop waiting after 2 minutes instead of leaving Send stuck.
      const watchdog = setTimeout(() => { if(!shown){ timedOut = true; ctl.abort(); } }, 120000);
      // Stop and the 2-minute timeout always end the wait, even if the request ignores the abort.
      const ended = new Promise((_, rej) => ctl.signal.addEventListener("abort", () => rej(Object.assign(new Error("cancelled"), {code:"cancelled", text: shown || ""})), {once:true}));
      ended.catch(() => {});
      const within = (p, ms) => Promise.race([p, ended, limit(new Promise(() => {}), ms)]);
      try{
      const files = S.files.slice(); S.files = []; renderFiles();
      // Show the question and "Thinking…" right away; attachments are read after.
      const userTurn = {role:"user", content:"", display:text || "(attached files)", files:files.map(f => f.name), at:new Date().toISOString()};
      S.turns.push(userTurn); ta.value = ""; render("");
      const imLim = S.limits && S.limits.images, maxImg = imLim ? imLim.maxCount || 0 : 0;
      const images = [], fileNotes = [], names = [];
      try{
        for(const f of files){
          names.push(f.name);
          if(/^image\//.test(f.type)){ if(images.length < maxImg){ images.push(f); fileNotes.push(`[Image attached: ${f.name}]`); } else fileNotes.push(`[Image ${f.name} not sent: too many images in one message]`); continue; }
          try{ await within(f._reading || Promise.resolve(), 15000); }catch(err){ if(ctl.signal.aborted) throw err; }
          if(!f._buf){ fileNotes.push(`[${f.name} could not be opened]`); continue; }
          if(/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)){
            note.textContent = `Reading ${f.name}…`;
            try{ const r = await within(readPdf(f, Math.max(0, Math.min(3, maxImg - images.length))), 45000);
              images.push(...r.images);
              fileNotes.push(`--- PDF: ${f.name} (${r.pages} page${r.pages > 1 ? "s" : ""}${r.images.length ? `, first ${r.images.length} attached as images` : ""}) ---\n${r.text.slice(0, MAX_FILE_TEXT) || "(no text layer: likely a scan; see the page images)"}`); }
            catch(err){ if(ctl.signal.aborted) throw err; fileNotes.push(`[PDF ${f.name} could not be read here; ask Harvey to paste its text if it matters]`); }
            continue;
          }
          fileNotes.push(`--- File: ${f.name} ---\n${new TextDecoder().decode(f._buf).slice(0, MAX_FILE_TEXT)}`);
        }
      }catch(err){ if(ctl.signal.aborted) throw err; }
      note.textContent = "";
      userTurn.content = [text || "(See the attached files.)", ...fileNotes].join("\n\n");
      const myRec = rec.id;
      let ctx = ""; try{ ctx = await within(contextText(rec), 30000); }catch(err){ if(ctl.signal.aborted) throw err; }
      const hist = S.turns.filter(t => t.role === "user" || t.role === "assistant").slice(-MAX_TURNS).map(t => ({role:t.role, content:String(t.content || "").slice(0, 20000) || "(empty)"}));
      while(hist.length && hist[0].role !== "user") hist.shift();
      const input = [{role:"user", content: RULES(cfg) + "\n\n" + ctx}, ...hist];
      try{
        const opts = {signal:ctl.signal, cache:false, modelTier:"complex", model:MODEL, onText: ({text:t}) => { shown = t; if(S.recId === myRec) render(t); }};
        if(images.length) opts.images = images;
        const r = await Promise.race([sample(input, opts), ended]);
        if(S.recId !== myRec) return;
        const sp = splitReply(r.text);
        S.turns.push({role:"assistant", content:r.text, actions:sp.actions || null, at:new Date().toISOString(), truncated:!!r.truncated});
        if(r.truncated) S.turns.push({role:"note", content:"That answer was cut short. Ask me to continue."});
      }catch(err){
        const c = err && err.code;
        if(S.recId === myRec){
          if(err && err.text) S.turns.push({role:"assistant", content:err.text + "\n\n*(interrupted)*", at:new Date().toISOString()});
          const msg = timedOut ? "No answer from Claude after 2 minutes. Try again; if it keeps happening, reload the page." : c === "cancelled" ? "Stopped." : c === "not_granted" || c === "sampling_disabled" ? "Claude isn't allowed for this dashboard. Allow it when claude.ai asks, then try again."
            : c === "rate_limited" ? "You've hit a Claude usage limit for now. Try again in a little while." : c === "prompt_too_large" ? "That's too much text at once. Start a New chat or attach less."
            : c === "image_rejected" ? "One of the images couldn't be used. Try a JPG or PNG under 20 MB." : c === "refused" ? "Claude declined that request. Rephrase it and try again."
            : c === "images_unavailable" ? "Images can't be sent from this view; text works." : `Something went wrong reaching Claude${c ? " (" + c + ")" : ""}. Try again.`;
          S.turns.push({role:"note", content:msg});
        }
      }
      clearTimeout(watchdog);
      if(S.recId === myRec){ saveThread(); }
      }catch(err){ S.turns.push({role:"note", content: timedOut ? "Reading the attachments took too long. Try again, or paste the text instead of attaching." : ctl.signal.aborted ? "Stopped." : `Something went wrong preparing that message${err && err.message ? ": " + err.message : ""}. Try again.`}); note.textContent = ""; }
      finally{ clearTimeout(watchdog); S.turns.forEach(t => { if(t.role === "user" && !t.content) t.content = t.display; }); S.busy = false; S.ctl = null; render(); }
    };

    /* ----- applying proposed changes ----- */
    log.addEventListener("click", async e => {
      const card = e.target.closest(".da-act[data-idx]"); if(!card) return;
      const t = S.turns[+card.dataset.idx]; if(!t) return;
      if(e.target.closest(".da-skip")){ t.applied = "Dismissed"; saveThread(); render(); return; }
      if(!e.target.closest(".da-apply")) return;
      const rec = cfg.current(); const errEl = card.querySelector(".da-err");
      if(!rec || rec.id !== S.recId){ errEl.textContent = "Open this deal again first."; return; }
      const picked = (t._items || []).filter((_, j) => { const cb = card.querySelector(`input[data-j="${j}"]`); return cb && cb.checked; });
      if(!picked.length){ errEl.textContent = "Tick at least one change."; return; }
      const patch = {}, done = [];
      for(const it of picked){
        if(it.kind === "u"){ const f = cfg.fields.find(x => x.key === it.k); let v = it.v;
          if(f.type === "number"){ v = parseFloat(String(v).replace(/[$,%\s]/g, "")); if(!isFinite(v)) continue; }
          else if(f.options && !f.options.includes(String(v))) continue; else v = String(v);
          patch[it.k] = v; done.push(`${f.label} ${v}`); }
        if(it.kind === "stage"){ patch[cfg.stageKey] = it.v; done.push(`stage ${it.v}`); }
        if(it.kind === "next"){ patch[cfg.nextKey] = it.v; done.push(`next touch ${it.v}`); }
        if(it.kind === "note"){ patch.__note = `[${today()} Deal Advisor] ${it.v}`; done.push("note added"); }
      }
      const track = picked.find(it => it.kind === "track");
      card.querySelectorAll("button").forEach(b => b.disabled = true); errEl.textContent = "Saving…";
      try{
        const apv = patch.appraised; // adapters may consume it
        if(Object.keys(patch).length) await cfg.apply(rec.id, patch);
        if(apv != null){ try{ const ids = cfg.hubIds ? await cfg.hubIds(rec.id) : null; if(ids && ids.hubPid) await saveAppraised(await getMcp(), ids.hubPid, apv, "From the Deal Advisor"); }catch(_){} }
        if(track){ await addTrack(rec, track.v); done.push(`added to ${TRACKS[track.v].label.split(" (")[0]}`); }
        t.applied = "Applied: " + done.join(", ");
        S.turns.push({role:"user", content:`(I applied these changes: ${done.join("; ")}.)`, hidden:true, at:new Date().toISOString()});
        saveThread(); render(); toast("Deal updated");
      }catch(err){ errEl.textContent = (err && err.message) || "Couldn't apply. Try again."; card.querySelectorAll("button").forEach(b => b.disabled = false); }
    });
    async function addTrack(rec, track){
      const ids = cfg.hubIds ? await cfg.hubIds(rec.id) : null;
      if(!ids || !ids.hubPid) throw new Error("This deal isn't linked to the back office yet. Tap “Sync back office”, then apply again.");
      const now = new Date().toISOString(), stage = TRACKS[track].stages[0];
      const rid = "d_" + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
      const exists = await d1("SELECT id FROM deals WHERE property_id = ? AND track = ?", [ids.hubPid, track]);
      if(exists.length) return;
      await d1(`INSERT OR IGNORE INTO deals (id, property_id, contact_id, track, stage, ref, next_touch, source, source_app, asking, notes, created_at, updated_at)
        SELECT ?, ?, contact_id, ?, ?, ?, ?, 'Deal Advisor', 'office', asking, ?, ?, ? FROM deals WHERE id = ?`,
        [rid, ids.hubPid, track, stage, await refFor(rec, ids), today(), `Added by the Deal Advisor from the ${cfg.appLabel}.`, now, now, ids.hubId]);
      await d1(`INSERT INTO activities (id, at, property_id, deal_id, kind, summary, by, source) VALUES (?, ?, ?, ?, 'created', ?, 'Deal Advisor', ?)`,
        ["a_" + rid.slice(2), now, ids.hubPid, rid, `Added to ${TRACKS[track].label.split(" (")[0]} by the Deal Advisor`, cfg.app]);
    }

    /* ----- deep link from the back office: #advise-d-xxxx ----- */
    async function fromHash(){
      const m = /^#advise-d-([a-z0-9]+)$/i.exec(location.hash || ""); if(!m) return;
      const hid = "d_" + m[1].toLowerCase();
      for(let i = 0; i < 60 && !(cfg.ready && cfg.ready()); i++) await new Promise(r => setTimeout(r, 500));
      let id = null; try{ id = cfg.findByHub ? await cfg.findByHub(hid) : null; }catch(_){}
      if(id){ await open(id); }
      else { panel.hidden = false; fab.hidden = true; await sync(); S.turns.length || log.insertAdjacentHTML("afterbegin", `<div class="da-msg sys">That deal isn't on this dashboard yet. Tap “Sync back office”, wait a moment, then open the link again.</div>`); }
      try{ window.history.replaceState(null, "", location.pathname + location.search); }catch(_){}
    }
    window.addEventListener("hashchange", fromHash);
    setTimeout(fromHash, 300);

    return { open, close, refresh: () => { if(!panel.hidden) sync(); }, get isOpen(){ return !panel.hidden; } };
  }
  return { mount, md, splitReply, fmv, FMV_RATIO, saveAppraised };
})();
