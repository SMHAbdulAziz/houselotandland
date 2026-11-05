// Owners & heirs questions, shown on the offer page after the seller picks an option.
// Answers are saved as JSON in offers.ownership; the Deal Desk uses them to decide who signs
// (one owner, co-owners + spouse, an estate representative, or the heirship letter of intent).

const Q = {
  en: {
    title: "A few questions so we prepare the right paperwork",
    sub: "This takes about two minutes. Answer what you know; \"I don't know\" is fine.",
    who: "Who owns the property today?",
    whoMe: "Just me", whoCo: "Me and other people", whoDead: "The owner has passed away", whoHelp: "I'm helping the owner (family member, agent, other)",
    yourName: "Your full name", yourRel: "Your relationship to the property or owner",
    home: "Is this property anyone's home (homestead) right now?", married: "Is the owner married?", spouse: "Spouse's full name", spouseEmail: "Spouse's email (if they're not on the deed)",
    coTitle: "Other owners on the deed", name: "Full name", rel: "Relationship", email: "Email", phone: "Phone", living: "Living?", under18: "Under 18?", willing: "Willing to sell?",
    add: "+ Add a person", remove: "Remove",
    deadName: "Name of the owner who passed away", dod: "Date of death (approximate is fine)", will: "Did they leave a will?",
    probate: "Has a probate case been opened?", execName: "Executor or administrator's name", execRole: "Their role", cause: "Cause number (if known)", county: "County",
    roleExec: "Independent executor", roleAdmin: "Administrator", roleOther: "Other / don't know",
    heirsTitle: "Family members who may inherit", heirsHelp: "List the spouse, children, parents or siblings. If a child has passed away, list that child's children.",
    permission: "I've told these people House Lot & Land Sales Co. may contact them, or I'm OK with you contacting them by mail or email about this property. (We won't call or text anyone until they give us their own permission.)",
    notes: "Anything else we should know? (someone living there, back taxes, family disagreements)",
    yes: "Yes", no: "No", unsure: "Don't know",
    save: "Send my answers", saved: "Thanks! We have what we need to prepare your paperwork. We'll contact you within one business day.",
    err: "Please check your answers and try again.",
  },
  es: {
    title: "Unas preguntas para preparar los documentos correctos",
    sub: "Toma unos dos minutos. Conteste lo que sepa; \"No sé\" está bien.",
    who: "¿Quién es dueño de la propiedad hoy?",
    whoMe: "Solo yo", whoCo: "Yo y otras personas", whoDead: "El dueño falleció", whoHelp: "Estoy ayudando al dueño (familiar, apoderado, otro)",
    yourName: "Su nombre completo", yourRel: "Su relación con la propiedad o el dueño",
    home: "¿La propiedad es la vivienda (homestead) de alguien actualmente?", married: "¿El dueño está casado?", spouse: "Nombre completo del cónyuge", spouseEmail: "Correo del cónyuge (si no está en la escritura)",
    coTitle: "Otros dueños en la escritura", name: "Nombre completo", rel: "Parentesco", email: "Correo", phone: "Teléfono", living: "¿Vive?", under18: "¿Menor de 18?", willing: "¿Dispuesto a vender?",
    add: "+ Agregar persona", remove: "Quitar",
    deadName: "Nombre del dueño que falleció", dod: "Fecha de fallecimiento (aproximada está bien)", will: "¿Dejó testamento?",
    probate: "¿Se abrió un caso de sucesión (probate)?", execName: "Nombre del albacea o administrador", execRole: "Su cargo", cause: "Número de causa (si lo sabe)", county: "Condado",
    roleExec: "Albacea independiente", roleAdmin: "Administrador", roleOther: "Otro / no sé",
    heirsTitle: "Familiares que podrían heredar", heirsHelp: "Incluya cónyuge, hijos, padres o hermanos. Si un hijo falleció, incluya a los hijos de ese hijo.",
    permission: "Les avisé a estas personas que House Lot & Land Sales Co. puede contactarlas, o estoy de acuerdo con que las contacten por correo postal o electrónico sobre esta propiedad. (No llamaremos ni enviaremos mensajes de texto a nadie hasta que nos dé su propio permiso.)",
    notes: "¿Algo más que debamos saber? (alguien vive ahí, impuestos atrasados, desacuerdos familiares)",
    yes: "Sí", no: "No", unsure: "No sé",
    save: "Enviar mis respuestas", saved: "¡Gracias! Tenemos lo necesario para preparar sus documentos. Le contactaremos en un día hábil.",
    err: "Revise sus respuestas e intente de nuevo.",
  },
};

export function ownersSection(lang, token, show, done) {
  const q = Q[lang];
  const yn = (name) => `<select name="${name}"><option value=""></option><option value="yes">${q.yes}</option><option value="no">${q.no}</option><option value="unsure">${q.unsure}</option></select>`;
  return `<section class="owners" id="owners" ${show ? "" : "hidden"}>
  <h2>${q.title}</h2>
  ${done ? `<p class="status ok">${q.saved}</p>` : `<p class="sub">${q.sub}</p>
  <form id="ownForm" novalidate>
    <fieldset><legend>${q.who}</legend>
      <label class="r"><input type="radio" name="who" value="me"> ${q.whoMe}</label>
      <label class="r"><input type="radio" name="who" value="co"> ${q.whoCo}</label>
      <label class="r"><input type="radio" name="who" value="deceased"> ${q.whoDead}</label>
      <label class="r"><input type="radio" name="who" value="helper"> ${q.whoHelp}</label>
    </fieldset>
    <div class="grid2"><label>${q.yourName}<input name="your_name" maxlength="120"></label><label>${q.yourRel}<input name="your_rel" maxlength="120"></label></div>
    <div class="grid2" data-show="me co helper"><label>${q.home}${yn("homestead")}</label><label>${q.married}${yn("married")}</label></div>
    <div class="grid2" data-show="me co helper" data-married><label>${q.spouse}<input name="spouse_name" maxlength="120"></label><label>${q.spouseEmail}<input name="spouse_email" type="email" maxlength="160"></label></div>
    <div data-show="co helper"><h3>${q.coTitle}</h3><div class="rows" data-rows="owners"></div><button type="button" class="link" data-add="owners">${q.add}</button></div>
    <div data-show="deceased">
      <div class="grid2"><label>${q.deadName}<input name="decedent_name" maxlength="120"></label><label>${q.dod}<input name="date_of_death" maxlength="40"></label></div>
      <div class="grid2"><label>${q.will}${yn("will")}</label><label>${q.probate}${yn("probate")}</label></div>
      <div data-probate class="grid2">
        <label>${q.execName}<input name="exec_name" maxlength="120"></label>
        <label>${q.execRole}<select name="exec_role"><option value=""></option><option value="independent executor">${q.roleExec}</option><option value="administrator">${q.roleAdmin}</option><option value="other">${q.roleOther}</option></select></label>
        <label>${q.cause}<input name="cause_number" maxlength="60"></label><label>${q.county}<input name="probate_county" maxlength="60"></label>
      </div>
      <h3>${q.heirsTitle}</h3><p class="sub">${q.heirsHelp}</p>
      <div class="rows" data-rows="heirs"></div><button type="button" class="link" data-add="heirs">${q.add}</button>
    </div>
    <label class="chk" data-show="co deceased helper"><input type="checkbox" name="permission"> <span>${q.permission}</span></label>
    <label>${q.notes}<textarea name="notes" rows="3" maxlength="1500"></textarea></label>
    <p class="status" id="ownMsg" role="status" aria-live="polite"></p>
    <button class="btn" type="submit">${q.save}</button>
  </form>`}
  </section>
  <script>${done ? "" : ownersScript(lang, token)}</script>`;
}

function ownersScript(lang, token) {
  const q = Q[lang];
  return `(function(){
  var f=document.getElementById("ownForm"); if(!f) return;
  var L=${JSON.stringify({ name: q.name, rel: q.rel, email: q.email, phone: q.phone, living: q.living, under18: q.under18, willing: q.willing, remove: q.remove, yes: q.yes, no: q.no, unsure: q.unsure, saved: q.saved, err: q.err })};
  function yn(n){return '<select data-k="'+n+'"><option value=""></option><option value="yes">'+L.yes+'</option><option value="no">'+L.no+'</option><option value="unsure">'+L.unsure+'</option></select>';}
  function addRow(kind){
    var box=f.querySelector('[data-rows="'+kind+'"]'); if(box.children.length>=20) return;
    var d=document.createElement("div"); d.className="row";
    d.innerHTML='<label>'+L.name+'<input data-k="name" maxlength="120"></label><label>'+L.rel+'<input data-k="rel" maxlength="60"></label>'+
      '<label>'+L.email+'<input data-k="email" type="email" maxlength="160"></label><label>'+L.phone+'<input data-k="phone" type="tel" maxlength="40"></label>'+
      '<label>'+L.living+yn("living")+'</label>'+(kind==="heirs"?'<label>'+L.under18+yn("under18")+'</label><label>'+L.willing+yn("willing")+'</label>':'')+
      '<button type="button" class="link" data-rm>'+L.remove+'</button>';
    d.querySelector("[data-rm]").onclick=function(){d.remove();};
    box.appendChild(d);
  }
  f.querySelectorAll("[data-add]").forEach(function(b){ b.onclick=function(){addRow(b.getAttribute("data-add"));}; });
  function sync(){
    var who=(f.querySelector('input[name=who]:checked')||{}).value||"";
    f.querySelectorAll("[data-show]").forEach(function(el){ el.hidden = who==="" || el.getAttribute("data-show").split(" ").indexOf(who)<0; });
    var m=f.querySelector("[data-married]"); if(m && !m.hidden) m.hidden = f.married.value!=="yes";
    var p=f.querySelector("[data-probate]"); if(p) p.hidden = f.probate.value!=="yes";
    if(who==="co" && !f.querySelector('[data-rows="owners"]').children.length) addRow("owners");
    if(who==="deceased" && !f.querySelector('[data-rows="heirs"]').children.length) addRow("heirs");
  }
  f.addEventListener("change", sync); sync();
  function rows(kind){ return Array.prototype.map.call(f.querySelectorAll('[data-rows="'+kind+'"] .row'), function(r){ var o={}; r.querySelectorAll("[data-k]").forEach(function(i){o[i.getAttribute("data-k")]=i.value;}); return o; }).filter(function(o){return (o.name||"").trim();}); }
  var msg=document.getElementById("ownMsg");
  f.addEventListener("submit", function(e){
    e.preventDefault();
    var who=(f.querySelector('input[name=who]:checked')||{}).value||"";
    if(!who || !f.your_name.value.trim()){ msg.textContent=L.err; msg.className="status err"; return; }
    var b=f.querySelector("button[type=submit]"); b.disabled=true;
    var data={who:who,your_name:f.your_name.value,your_rel:f.your_rel.value,homestead:f.homestead.value,married:f.married.value,spouse_name:f.spouse_name.value,spouse_email:f.spouse_email.value,
      owners:rows("owners"),decedent_name:f.decedent_name.value,date_of_death:f.date_of_death.value,will:f.will.value,probate:f.probate.value,exec_name:f.exec_name.value,exec_role:f.exec_role.value,
      cause_number:f.cause_number.value,probate_county:f.probate_county.value,heirs:rows("heirs"),permission:f.permission.checked,notes:f.notes.value,lang:${JSON.stringify(lang)}};
    fetch("/api/offer/${token}/owners",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)})
      .then(function(r){return r.json().then(function(j){ if(!r.ok||!j.ok) throw new Error(j.message||L.err); });})
      .then(function(){ f.outerHTML='<p class="status ok">'+L.saved+'</p>'; })
      .catch(function(err){ msg.textContent=err.message||L.err; msg.className="status err"; b.disabled=false; });
  });
  window.hllShowOwners=function(){ var s=document.getElementById("owners"); s.hidden=false; setTimeout(function(){s.scrollIntoView({behavior:"smooth"});},400); };
})();`;
}

export const OWNERS_CSS = `
.owners{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0}.owners h2{margin:0 0 6px;font-size:1.25rem}
.owners h3{margin:16px 0 6px;font-size:1.05rem}.owners .sub{color:var(--muted);margin:0 0 12px}
.owners fieldset{border:0;padding:0;margin:0 0 12px}.owners legend{font-weight:700;margin-bottom:6px}.owners .r{display:flex;gap:8px;align-items:center;padding:6px 0;font-weight:500}
.owners label{display:grid;gap:4px;font-weight:600;font-size:14px}.owners input,.owners select,.owners textarea{font:16px Inter,sans-serif;padding:10px;border:1px solid #cbd5e1;border-radius:8px;width:100%;background:#fff}
.owners .r input,.owners .chk input{width:20px;height:20px}.owners .chk{display:flex;gap:10px;align-items:flex-start;font-weight:500;margin:12px 0}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:10px 0}
.rows .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;border:1px solid var(--line);border-radius:10px;padding:12px;margin:8px 0}
.link{background:none;border:0;color:var(--blue);font:600 15px Inter,sans-serif;cursor:pointer;padding:6px 0;justify-self:start}
[hidden]{display:none!important}`;

export function saveOwners(b) {
  if (!b || typeof b !== "object") return null;
  const c = (v, n) => (v == null ? "" : String(v).replace(/[\u0000-\u001F]/g, " ").trim().slice(0, n));
  const yn = (v) => (["yes", "no", "unsure"].includes(v) ? v : "");
  const person = (o, heir) => ({ name: c(o.name, 120), rel: c(o.rel, 60), email: c(o.email, 160), phone: c(o.phone, 40), living: yn(o.living), ...(heir ? { under18: yn(o.under18), willing: yn(o.willing) } : {}) });
  const who = ["me", "co", "deceased", "helper"].includes(b.who) ? b.who : "";
  if (!who || !c(b.your_name, 120)) return { error: "missing" };
  return {
    who, your_name: c(b.your_name, 120), your_rel: c(b.your_rel, 120),
    homestead: yn(b.homestead), married: yn(b.married), spouse_name: c(b.spouse_name, 120), spouse_email: c(b.spouse_email, 160),
    owners: (Array.isArray(b.owners) ? b.owners : []).slice(0, 20).map((o) => person(o, false)).filter((o) => o.name),
    decedent_name: c(b.decedent_name, 120), date_of_death: c(b.date_of_death, 40), will: yn(b.will), probate: yn(b.probate),
    exec_name: c(b.exec_name, 120), exec_role: c(b.exec_role, 40), cause_number: c(b.cause_number, 60), probate_county: c(b.probate_county, 60),
    heirs: (Array.isArray(b.heirs) ? b.heirs : []).slice(0, 20).map((o) => person(o, true)).filter((o) => o.name),
    permission: b.permission === true, notes: c(b.notes, 1500), lang: b.lang === "es" ? "es" : "en",
  };
}
