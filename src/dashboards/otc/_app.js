<script>
// ---- OTC Tax Parcel Finder ----
// Records: collection "parcels". Buy box: doc config/buybox. Scan progress: runs/latest. Back office track: "taxotc".
// Every parcel is scored live against the buy box: price, flood zone, other liens, comps (count and median vs. multiple × total cost).
const STAGES=["Found","Screened","Checked","Qualifies","Buying","Bought","Redemption / title","Sold","Pass"];
const KINDS={deed:"OTC tax deed",lien:"OTC tax lien",struck:"Texas struck-off resale"};
const DEF_BB={maxPrice:1000,maxLiens:5000,multiple:5,minComps:3,compMonths:12,compMiles:1,noFlood:true,kinds:["deed","lien","struck"],states:[],quietTitle:1500};
const SCAN_TASK="trig_011BbbxoeBe63M7ELjcmyE3H";
let rows=[],bb={...DEF_BB},bbSaved=null,stageF=null,verdictF="",editing=null,col=null,dbRef=null,mcpRef=null,readOnly=false,run=null;
const $=id=>document.getElementById(id);
function toast(t){const el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600)}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const num=v=>{if(v==null||v==="")return null;const n=parseFloat(String(v).replace(/[$,\s]/g,""));return isFinite(n)?n:null};
const usd=v=>v==null||!isFinite(v)?"—":"$"+Math.round(v).toLocaleString();
$("f-stage").innerHTML=STAGES.map(s=>`<option>${s}</option>`).join("");
$("f-kind").innerHTML=Object.entries(KINDS).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("");
$("f-state").innerHTML=Object.entries(HUB_STATES).map(([k,v])=>`<option value="${k}">${k} · ${v}</option>`).join("");
$("kindF").innerHTML+=Object.entries(KINDS).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("");

/* ---------- scoring ---------- */
function costOf(r){const p=num(r.price),f=num(r.fees)||0,l=num(r.liens);return{price:p,fees:f,liens:l,total:(p||0)+f+(l||0),liensKnown:l!=null}}
function score(r,B=bb){
  const c=costOf(r),t=[];
  const inStates=!B.states||!B.states.length||B.states.includes(String(r.state||"").toUpperCase());
  const inKinds=(B.kinds||[]).includes(r.kind);
  t.push({k:"box",label:inKinds&&inStates?"In buy box":"Outside buy box",st:inKinds&&inStates?"pass":"fail",why:!inKinds?`${KINDS[r.kind]||"This kind"} isn't selected in the buy box`:!inStates?`${r.state||"This state"} isn't in the buy box states`:""});
  t.push(c.price==null?{k:"price",label:"Price unknown",st:"unk"}:{k:"price",label:`Price ${usd(c.price)}`,st:c.price<=B.maxPrice?"pass":"fail",why:c.price>B.maxPrice?`over ${usd(B.maxPrice)}`:""});
  if(B.noFlood){const f=r.flood||{};t.push(f.sfha===true?{k:"flood",label:`Flood zone${f.zone?" "+f.zone:""}`,st:"fail"}:f.sfha===false?{k:"flood",label:`No flood zone${f.zone?" ("+f.zone+")":""}`,st:"pass"}:{k:"flood",label:"Flood unknown",st:"unk"})}
  t.push(!c.liensKnown?{k:"liens",label:"Liens unknown",st:"unk"}:{k:"liens",label:`Other liens ${usd(c.liens)}`,st:c.liens<=B.maxLiens?"pass":"fail",why:c.liens>B.maxLiens?`over ${usd(B.maxLiens)}`:""});
  const cp=r.comps,need=B.multiple*c.total;
  if(!cp||cp.count==null)t.push({k:"comps",label:"Comps not checked",st:"unk"});
  else if(cp.count<B.minComps)t.push({k:"comps",label:`${cp.count} comp${cp.count===1?"":"s"} (need ${B.minComps})`,st:"fail"});
  else if(cp.median==null)t.push({k:"comps",label:`${cp.count} comps, no prices`,st:"unk"});
  else t.push({k:"comps",label:`Comps median ${usd(cp.median)} vs ${usd(need)} needed`,st:cp.median>=need?(c.liensKnown?"pass":"unk"):"fail",why:!c.liensKnown&&cp.median>=need?"passes at $0 liens; check liens":""});
  const verdict=t.some(x=>x.st==="fail")?"f":t.every(x=>x.st==="pass")?"q":"n";
  return{tests:t,verdict,cost:c,need};
}
const VERDICT={q:"Qualifies",n:"Needs check",f:"Fails"};

/* ---------- list ---------- */
function searchMatch(rec,q){const words=String(q||"").toLowerCase().trim().split(/\s+/).filter(Boolean);if(!words.length)return true;
  const hay=["name","address","city","county","state","zip","apn","sourceName","notes","next","landUse","stage"].map(k=>rec[k]??"").join(" ").toLowerCase();return words.every(w=>hay.includes(w))}
let listPager=null;
function render(){
  const counts=Object.fromEntries(STAGES.map(s=>[s,0]));rows.forEach(r=>{if(counts[r.stage]!=null)counts[r.stage]++});
  $("pipe").innerHTML=STAGES.map(s=>`<button type="button" class="stage" data-s="${esc(s)}" aria-pressed="${stageF===s}"><b>${counts[s]}</b><span>${esc(s)}</span></button>`).join("");
  const scored=rows.map(r=>({r,s:score(r)}));
  const vc={q:0,n:0,f:0};scored.forEach(x=>vc[x.s.verdict]++);
  $("vchips").innerHTML=[["","All"],["q",`Qualifies (${vc.q})`],["n",`Needs check (${vc.n})`],["f",`Fails (${vc.f})`]].map(([v,l])=>`<button type="button" class="chip" data-v="${v}" aria-pressed="${verdictF===v}">${esc(l)}</button>`).join("");
  const sts=[...new Set(rows.map(r=>r.state).filter(Boolean))].sort();const sf=$("stateF"),cur=sf.value;
  sf.innerHTML=`<option value="">All states</option>`+sts.map(s=>`<option ${s===cur?"selected":""}>${esc(s)}</option>`).join("");
  const q=$("listSearch").value,kf=$("kindF").value,stf=sf.value,today=new Date().toISOString().slice(0,10);
  const vis=scored.filter(({r,s})=>searchMatch(r,q)&&(!stageF||r.stage===stageF)&&(!verdictF||s.verdict===verdictF)&&(!kf||r.kind===kf)&&(!stf||r.state===stf))
    .sort((a,b)=>"qnf".indexOf(a.s.verdict)-"qnf".indexOf(b.s.verdict)||(a.r.deadline||"9").localeCompare(b.r.deadline||"9")||(num(a.r.price)??1e9)-(num(b.r.price)??1e9));
  if(!listPager)listPager=makePager("listPager","hll_otc_rows",render,"");
  const shown=listPager.slice(vis);
  $("list").innerHTML=vis.length?shown.map(({r,s})=>card(r,s,today)).join(""):`<div class="empty">${rows.length?"No parcels match this filter.":"No parcels yet. Tap “Find parcels” to scan county lists, or “+ Add parcel” to enter one."}</div>`;
}
function card(r,s,today){
  const c=s.cost,cp=r.comps,qt=num(bb.quietTitle)||0;
  const loc=[r.address,r.city,[r.state,r.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return `<article class="card">
    <div class="row1">
      <div><p class="name">${esc(r.name||r.address||("Parcel "+(r.apn||"")))}</p><div class="loc">${esc(loc)}${r.county?` · ${esc(r.county)} Co.`:""}${r.apn?` · APN ${esc(r.apn)}`:""} · ${esc(KINDS[r.kind]||"Kind?")}${r.landUse?` · ${esc(r.landUse)}`:""}${r.acres?` · ${esc(r.acres)} ac`:""}</div></div>
      <div class="pills"><span class="verdict ${s.verdict}">${VERDICT[s.verdict]}</span><span class="pill st">${esc(r.stage||"Found")}</span></div>
    </div>
    <div class="tests">${s.tests.map(t=>`<span class="t ${t.st}" title="${esc(t.why||"")}">${t.st==="pass"?"✓":t.st==="fail"?"✗":"?"} ${esc(t.label)}</span>`).join("")}</div>
    <div class="math">Cost: <b>${usd(c.price)}</b> price${c.fees?` + ${usd(c.fees)} fees`:""} + ${c.liensKnown?usd(c.liens):"? "} liens = <b>${usd(c.total)}</b>${c.liensKnown?"":" (liens unknown)"} · × ${bb.multiple} = <b>${usd(s.need)}</b> needed
      ${cp&&cp.median!=null?` · comps median <b>${usd(cp.median)}</b> (${cp.count} sales${cp.avg!=null?`, avg ${usd(cp.avg)}`:""})`:""}${Number(r.appraised)>0?` · county appraised ${usd(r.appraised)} → FMV <b>${usd(r.fmv||DealAdvisor.fmv(r.appraised))}</b>`:""}${qt?` · quiet title est. ${usd(qt)} (not in the test)`:""}</div>
    ${r.kind==="lien"?`<p class="warnbox">Tax lien: you buy the lien certificate, not the property. The owner can redeem with interest; you only get the parcel if they don't, after the state's redemption period and foreclosure steps.</p>`:""}
    ${r.deadline?`<p class="next ${r.deadline<today?"due":""}"><strong>Deadline:</strong> ${esc(r.deadline)}</p>`:""}
    ${r.next?`<p class="next ${r.date&&r.date<today&&!["Sold","Pass"].includes(r.stage)?"due":""}"><strong>Next:</strong> ${esc(r.next)}${r.date?` · ${esc(r.date)}`:""}</p>`:""}
    ${cp&&cp.items&&cp.items.length?`<details class="enr"><summary>Comps · ${esc(cp.months||bb.compMonths)} mo, ${esc(cp.miles||bb.compMiles)} mi · checked ${esc(String(cp.at||"").slice(0,10))}</summary><div class="comps">${cp.items.slice(0,10).map(x=>`<div><span>${usd(x.price)}</span><span>${esc(x.date||"")}</span><span>${esc(x.address||"")}</span>${x.miles!=null?`<span>${esc(x.miles)} mi</span>`:""}</div>`).join("")}</div></details>`:""}
    ${cp&&cp.error?`<p class="note">Comps: ${esc(cp.error)}</p>`:""}
    ${r.notes?`<p class="note">${esc(r.notes)}</p>`:""}
    <div class="acts">${readOnly?"":`<button type="button" data-edit="${r.id}">Edit</button>`}<button type="button" data-advise="${r.id}">✦ Deal Advisor</button>${readOnly?"":`<button type="button" data-check="${r.id}" title="BatchData property lookup (liens, value, type, flood if available) plus a comps pull for the buy-box window. About 2 BatchData pulls.">Check parcel</button>`}${r.lat&&r.lon?`<a href="https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(r.lat+","+r.lon)}" target="_blank" rel="noopener">FEMA flood map ↗</a>`:loc?`<a href="https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(loc)}" target="_blank" rel="noopener">FEMA flood map ↗</a>`:""}${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.sourceName||"County list")} ↗</a>`:r.sourceName?`<span class="note">${esc(r.sourceName)}</span>`:""}</div>
  </article>`;
}
document.addEventListener("click",e=>{
  const s=e.target.closest("[data-s]");if(s){stageF=stageF===s.dataset.s?null:s.dataset.s;listPager&&listPager.reset();render();return}
  const v=e.target.closest("[data-v]");if(v){verdictF=v.dataset.v;listPager&&listPager.reset();render();return}
  const ed=e.target.closest("[data-edit]");if(ed){openSheet(rows.find(x=>x.id===ed.dataset.edit));return}
  const ad=e.target.closest("[data-advise]");if(ad&&advisor){advSel=ad.dataset.advise;advisor.open(advSel);return}
  const ck=e.target.closest("[data-check]");if(ck){checkParcel(ck.dataset.check,ck);return}
});
["kindF","stateF"].forEach(id=>$(id).addEventListener("change",()=>{listPager&&listPager.reset();render()}));
$("listSearch").addEventListener("input",()=>{listPager&&listPager.reset();render()});

/* ---------- add / edit ---------- */
const F=["kind","apn","address","city","zip","county","state","price","fees","liens","landUse","acres","appraised","deadline","stage","date","next","sourceName","url","notes"];
const NUMF=new Set(["price","fees","liens","appraised"]);
function openSheet(r){
  editing=r||null;$("formTitle").textContent=r?"Edit parcel":"Add parcel";$("delBtn").hidden=!r;
  F.forEach(k=>$("f-"+k).value=r?(r[k]??""):({kind:"deed",state:"FL",stage:"Found"}[k]||""));
  $("f-flood").value=r&&r.flood?(r.flood.sfha===true?"yes":r.flood.sfha===false?"no":""):"";
  $("sheet").hidden=false;$("f-apn").focus();
}
$("addBtn").onclick=()=>openSheet(null);
$("cancelBtn").onclick=()=>$("sheet").hidden=true;
$("sheet").addEventListener("click",e=>{if(e.target.id==="sheet")$("sheet").hidden=true});
$("form").addEventListener("submit",async e=>{
  e.preventDefault();if(!col){toast("Saving isn't available in this view");return}
  const body={};F.forEach(k=>{const v=$("f-"+k).value.trim();body[k]=NUMF.has(k)?num(v):v});
  body.state=hubNormState(body.state)||body.state;
  if(!body.address&&!body.apn){toast("Enter a street address or a parcel ID.");return}
  body.name=body.address||("Parcel "+body.apn);
  if(body.appraised>0)body.fmv=DealAdvisor.fmv(body.appraised);
  const fv=$("f-flood").value,prevF=editing&&editing.flood||{};
  if(fv==="")body.flood=prevF.source&&prevF.source!=="entered by hand"?prevF:{sfha:null};
  else if(fv!==(prevF.sfha===true?"yes":prevF.sfha===false?"no":""))body.flood={sfha:fv==="yes",zone:"",source:"entered by hand",at:new Date().toISOString()};
  if(body.liens!==(editing?num(editing.liens):null))body.liensSource=body.liens==null?"":"entered by hand";
  body.updated=new Date().toISOString();
  try{if(editing)await col.doc(editing.id).update(body);else await col.add({...body,foundAt:body.updated,source:"Added by hand"});$("sheet").hidden=true;toast("Saved")}
  catch(err){if(err?.code==="invalid_argument"){readOnly=true;render();toast("You have view-only access")}else toast("Couldn't save. Try again in a moment.")}
});
let delArmed=false;
$("delBtn").onclick=async()=>{
  if(!delArmed){delArmed=true;$("delBtn").textContent="Tap again to delete";setTimeout(()=>{delArmed=false;$("delBtn").textContent="Delete"},3000);return}
  delArmed=false;$("delBtn").textContent="Delete";
  try{await col.doc(editing.id).delete();$("sheet").hidden=true;toast("Deleted")}catch{toast("Couldn't delete. Try again.")}
};

/* ---------- Check parcel: BatchData lookup (liens, value, type, location, flood if present) + comps ---------- */
const BD="BatchData";
const bdParse=r=>{const p=r&&r.payload;if(p&&typeof p==="object")return p;try{return JSON.parse(p)}catch(_){return null}};
function bdErr(e){const c=e&&e.code;
  if(c==="server_not_connected"||c==="selection_required")return "BatchData isn't connected for this view. Add or reconnect it in Settings → Connectors.";
  if(c==="needs_reauth")return "BatchData needs you to sign in again in Settings → Connectors.";
  if(c==="not_in_manifest"||c==="approval_required"||c==="not_granted")return "BatchData needs your permission. Tap Check parcel again and choose Allow.";
  if(c==="tool_error")return "BatchData couldn't process this parcel. Check the street, city and ZIP (or your BatchData balance).";
  if(c==="server_unavailable")return "BatchData didn't respond. Try again in a minute.";
  return "BatchData lookup failed. Try again.";}
// Find the first value under any key matching re (BatchData field names vary by dataset).
function findKey(o,re,depth=0){if(!o||typeof o!=="object"||depth>5)return undefined;for(const [k,v] of Object.entries(o)){if(re.test(k)&&(typeof v!=="object"||v===null))return v}for(const v of Object.values(o)){if(v&&typeof v==="object"){const f=findKey(v,re,depth+1);if(f!==undefined)return f}}return undefined}
const SFHA=/^(A|AE|AH|AO|AR|A99|V|VE|A\d+|V\d+)$/i;
function floodFrom(p){
  const sf=findKey(p,/sfha|specialFloodHazard|inFloodZone|floodHazard/i),zone=findKey(p,/^floodZone(Code)?$|^fldZone$|femaFloodZone/i);
  if(typeof sf==="boolean")return{sfha:sf,zone:zone?String(zone):"",source:"BatchData"};
  if(typeof sf==="string"&&/^(y|n|t|f|true|false|yes|no)$/i.test(sf))return{sfha:/^(y|t|true|yes)$/i.test(sf),zone:zone?String(zone):"",source:"BatchData"};
  if(zone)return{sfha:SFHA.test(String(zone).trim()),zone:String(zone),source:"BatchData"};
  return null;
}
// Comps result: find the array of comparable records and read price, sale date, address and distance from each.
function compsFrom(res){
  let arr=null;const walk=(o,d=0)=>{if(arr||!o||typeof o!=="object"||d>4)return;for(const v of Object.values(o)){if(Array.isArray(v)&&v.length&&typeof v[0]==="object"&&v.some(x=>findKey(x,/price/i)!=null)){arr=v;return}}for(const v of Object.values(o))if(v&&typeof v==="object"&&!Array.isArray(v))walk(v,d+1)};walk(res);
  const items=(arr||[]).map(x=>{const s=x.sale&&x.sale.lastSale||{},a=x.address||{};
    const price=num(s.price??x.lastSalePrice??x.salePrice??x.price??findKey(x,/^(lastSalePrice|salePrice|soldPrice|price)$/i));
    const date=String(s.saleDate??x.saleDate??x.lastSaleDate??findKey(x,/saleDate|soldDate|recordingDate/i)??"").slice(0,10);
    const addr=typeof a==="string"?a:[a.street,a.city].filter(Boolean).join(", ")||x.street||"";
    const mi=num(x.distance??x.distanceMiles??findKey(x,/distance/i));
    return{price,date,address:addr,miles:mi!=null?Math.round(mi*100)/100:null}}).filter(x=>x.price>0);
  const total=num(findKey(res,/^(total|totalCount|count|resultCount)$/i));
  const prices=items.map(x=>x.price).sort((a,b)=>a-b),m=prices.length;
  const median=m?(m%2?prices[(m-1)/2]:(prices[m/2-1]+prices[m/2])/2):null;
  const avg=num(findKey(res,/averagePrice/i));
  return{count:total!=null&&total>=m&&total<1e6?total:m,median,avg,items,found:!!arr};
}
async function checkParcel(id,btn){
  const r=rows.find(x=>x.id===id);if(!r)return;
  if(readOnly||!col){toast("You have view-only access here.");return}
  const st=hubNormState(r.state)||"";
  if(!r.address||!(r.city||r.zip)||!st){toast("Add the street address, a city or ZIP, and the state first.");openSheet(r);return}
  if(!mcpRef)mcpRef=await window.claude.use("mcp").catch(()=>null);
  if(!mcpRef){toast("BatchData isn't available in this view. Open the dashboard in claude.ai.");return}
  const t0=btn.textContent;btn.disabled=true;btn.textContent="Looking up…";
  const patch={updated:new Date().toISOString()};const now=patch.updated;
  try{
    const input={property_street:r.address,property_state:st};if(r.city)input.property_city=r.city;if(hubZip5(r.zip))input.property_zip=hubZip5(r.zip);
    const res=bdParse(await mcpRef.callTool(BD,"lookup_property",input));const p=(res&&(res.property||res))||{};
    if(p.address||p.building||p.valuation||p.assessment||p.lot){
      const a=p.address||{},g=p.general||{},lot=p.lot||{},b=p.building||{},as=p.assessment||{},ol=p.openLien||{};
      const fill=(k,v)=>{if(v!=null&&v!==""&&(r[k]==null||r[k]===""))patch[k]=v};
      fill("zip",a.zip);fill("county",a.county);fill("city",a.city);fill("landUse",[g.propertyTypeCategory,g.propertyTypeDetail].filter(Boolean).join(" · "));
      fill("acres",lot.lotSizeAcres?String(Math.round(lot.lotSizeAcres*100)/100):"");
      const lat=num(a.latitude??findKey(p,/^lat(itude)?$/i)),lon=num(a.longitude??findKey(p,/^(lon|lng|longitude)$/i));if(lat&&lon){patch.lat=lat;patch.lon=lon}
      const appr=as.totalMarketValue||as.totalAssessedValue||null;if(appr){patch.appraised=appr;patch.fmv=DealAdvisor.fmv(appr)}
      // Other liens: open mortgages/liens BatchData knows about. Tax liens being bought here aren't "other" liens.
      const lienBal=num(ol.totalOpenLienBalance);if(lienBal!=null&&(r.liensSource||"")!=="entered by hand"){patch.liens=lienBal;patch.liensSource="BatchData open liens (mortgages; confirm judgments and code liens with the county)"}
      else if(lienBal==null&&r.liens==null&&ol&&(ol.totalOpenLienCount===0||(p.quickLists&&p.quickLists.freeAndClear))){patch.liens=0;patch.liensSource="BatchData: no open liens (confirm with the county)"}
      const fl=floodFrom(p);if(fl&&(!r.flood||r.flood.source!=="entered by hand"))patch.flood={...fl,at:now};
      patch.enrich={at:now,estimatedValue:num(p.valuation&&p.valuation.estimatedValue),owner:(p.owner&&p.owner.fullName)||"",ownerOccupied:p.owner?p.owner.ownerOccupied:null,yearBuilt:b.yearBuilt||null,sqft:b.totalBuildingAreaSquareFeet||b.livingAreaSquareFeet||null,lienCount:ol.totalOpenLienCount??null,taxDefault:!!(p.quickLists&&p.quickLists.taxDefault)};
    } else patch.enrich={at:now,error:"BatchData has no record at that address."};
    btn.textContent="Pulling comps…";
    const end=new Date(),start=new Date(end);start.setMonth(start.getMonth()-(+bb.compMonths||12));
    const landish=/land|vacant|lot|acre/i.test((patch.landUse||r.landUse||"")+" "+(r.name||""));
    const cin={subject_property_street:r.address,subject_property_state:st,distance_miles:+bb.compMiles||1,last_sold_date_min:start.toISOString().slice(0,10),last_sold_date_max:end.toISOString().slice(0,10),
      use_year_built:false,use_bathrooms:false};
    if(r.city||patch.city)cin.subject_property_city=r.city||patch.city;if(hubZip5(r.zip||patch.zip))cin.subject_property_zip=hubZip5(r.zip||patch.zip);
    if(landish){cin.use_area=false;cin.use_bedrooms=false;cin.use_lot_size=true;cin.min_lot_size_percent=-50;cin.max_lot_size_percent=100}
    try{const cr=bdParse(await mcpRef.callTool(BD,"comparable_property_preview",cin));const c=compsFrom(cr||{});
      patch.comps={...c,at:now,months:+bb.compMonths||12,miles:+bb.compMiles||1,land:landish};if(!c.found)patch.comps.error="The comps result came back in a shape this page couldn't read; ask Claude in chat to check it."}
    catch(e){patch.comps={count:null,at:now,error:bdErr(e)}}
    await col.doc(id).update(patch);
    if(patch.appraised&&dbRef){try{const h=await dbRef.doc("hubmap/"+id).get();if(h.exists&&h.data().hubPid)await DealAdvisor.saveAppraised(mcpRef,h.data().hubPid,patch.appraised,"BatchData (appraisal district)")}catch(_){}}
    const s=score({...r,...patch});toast(`Checked: ${VERDICT[s.verdict]}.`);
  }catch(e){toast(bdErr(e))}
  btn.disabled=false;btn.textContent=t0;
}

/* ---------- buy box settings ---------- */
const BBN=["maxPrice","maxLiens","multiple","minComps","compMonths","compMiles","quietTitle"];
function renderBB(){
  BBN.forEach(k=>{if(document.activeElement!==$("bb-"+k))$("bb-"+k).value=bb[k]});
  $("bb-noFlood").checked=!!bb.noFlood;
  if(document.activeElement!==$("bb-states"))$("bb-states").value=(bb.states||[]).join(", ");
  $("bb-kinds").innerHTML=Object.entries(KINDS).map(([k,l])=>`<button type="button" class="chip" data-bbk="${k}" aria-pressed="${bb.kinds.includes(k)}">${esc(l)}</button>`).join("");
  $("bb-kinds").querySelectorAll("[data-bbk]").forEach(b=>b.onclick=()=>{const k=b.dataset.bbk;bb.kinds=bb.kinds.includes(k)?bb.kinds.filter(x=>x!==k):[...bb.kinds,k];renderBB();render()});
  $("bbSaved").textContent=bbSaved?`Saved ${new Date(bbSaved).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}`:"Defaults (not saved yet)";
  $("bbSave").disabled=readOnly||!dbRef;
}
BBN.forEach(k=>$("bb-"+k).addEventListener("input",e=>{const v=parseFloat(e.target.value);if(isFinite(v)&&v>=0){bb[k]=v;render()}}));
$("bb-noFlood").addEventListener("change",e=>{bb.noFlood=e.target.checked;render()});
$("bb-states").addEventListener("input",e=>{bb.states=[...new Set(e.target.value.toUpperCase().split(/[^A-Z]+/).filter(x=>HUB_STATES[x]))];render()});
$("bbBtn").onclick=()=>{const f=$("bbBox");f.hidden=!f.hidden;$("bbBtn").setAttribute("aria-expanded",String(!f.hidden));if(!f.hidden)f.scrollIntoView({behavior:"smooth",block:"start"})};
$("bbSave").onclick=async()=>{
  if(!dbRef)return;if(!bb.kinds.length){toast("Pick at least one parcel kind.");return}
  const clean={...bb};BBN.forEach(k=>clean[k]=Math.max(0,+clean[k]||0));clean.multiple=Math.max(1,clean.multiple);clean.minComps=Math.max(1,Math.round(clean.minComps));clean.compMonths=Math.max(1,Math.min(60,Math.round(clean.compMonths)));
  try{await dbRef.doc("config/buybox").set({...clean,updatedAt:new Date().toISOString()});toast("Buy box saved")}catch{toast("Couldn't save the buy box. Try again.")}
};
$("bbReset").onclick=()=>{bb={...DEF_BB,kinds:[...DEF_BB.kinds],states:[]};renderBB();render();toast("Defaults loaded. Tap Save buy box to keep them.")};

/* ---------- scan (scheduled task) ---------- */
$("findBtn").onclick=()=>{const f=$("finder");f.hidden=!f.hidden;$("findBtn").setAttribute("aria-expanded",String(!f.hidden));if(!f.hidden)f.scrollIntoView({behavior:"smooth",block:"start"})};
function renderRun(){
  const box=$("runState"),btn=$("searchBtn");
  const when=iso=>iso?new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"";
  btn.disabled=readOnly||!dbRef;
  if(!run){box.textContent="No scans yet.";return}
  if(run.status==="queued"||run.status==="running"){
    const stale=Date.now()-new Date(run.startedAt||run.requestedAt||0).getTime()>60*60*1000;
    if(!stale){box.innerHTML=`<span class="pill warn">Scanning</span> ${esc(run.status==="running"?`Since ${when(run.startedAt)}. New parcels appear below as they're added.`:`Requested ${when(run.requestedAt)}. Starting up.`)}`;btn.disabled=true;return}
    box.innerHTML=`<span class="pill warn">No response</span> ${esc(`The scan requested ${when(run.requestedAt||run.startedAt)} hasn't reported back. You can start another.`)}`;return;
  }
  if(run.status==="done")box.innerHTML=`<span class="pill ok">${run.added??0} added</span> ${esc(`${when(run.finishedAt)}. ${run.message||""}`)}`;
  else if(run.status==="failed")box.innerHTML=`<span class="pill bad">Didn't finish</span> ${esc(`${when(run.finishedAt)}. ${run.message||"The scan stopped."}`)}`;
}
async function runFail(message){try{await dbRef.doc("runs/latest").update({status:"failed",finishedAt:new Date().toISOString(),message})}catch{}toast(message);$("searchBtn").disabled=false}
$("searchBtn").onclick=async()=>{
  if(!dbRef){toast("Scanning needs the dashboard's database, which isn't available in this view.");return}
  $("searchBtn").disabled=true;const now=new Date().toISOString();
  try{await dbRef.doc("runs/latest").set({status:"queued",requestedAt:now,added:null,message:""})}catch{toast("Couldn't start the scan. Try again.");$("searchBtn").disabled=false;return}
  if(!mcpRef)mcpRef=await window.claude.use("mcp").catch(()=>null);
  if(!mcpRef){await runFail("This view can't start scans. Open the dashboard in claude.ai, or ask Claude in chat to run the OTC tax parcel scan.");return}
  try{await mcpRef.callTool("Claude Code Remote","fire_trigger",{trigger_id:SCAN_TASK,text:"Run requested from the OTC Tax Parcel Finder."});toast("Scan started")}
  catch(e){const c=e&&e.code;
    const msg=c==="server_not_connected"||c==="selection_required"?"Starting a scan needs the Claude Code Remote connection. Allow it when the page asks, then try again."
      :c==="not_in_manifest"||c==="approval_required"||c==="not_granted"?"The scan needs your permission to start. Tap Scan now again and choose Allow."
      :c==="tool_error"?"The scan task couldn't start. It may be paused; check Scheduled tasks."
      :c==="server_unavailable"||c==="upstream_error"?"No response from the scan service. It may still start; watch this line before trying again."
      :"The scan couldn't start. Try again in a moment.";
    if(c==="server_unavailable"||c==="upstream_error"){toast(msg);return}
    await runFail(msg)}
};

/* ---------- Deal Advisor ---------- */
let advSel=null;
var advisor=window.DealAdvisor?DealAdvisor.mount({
  app:"taxotc", appLabel:"OTC Tax Parcel Finder (over-the-counter tax deeds and liens, Texas struck-off resale)", track:"taxotc", stages:STAGES, stageKey:"stage", nextKey:"date", notesKey:"notes",
  fields:[{key:"address",label:"Street address",type:"text"},{key:"city",label:"City",type:"text"},{key:"zip",label:"ZIP",type:"text"},{key:"county",label:"County",type:"text"},{key:"state",label:"State",type:"text"},
    {key:"apn",label:"Parcel ID / APN",type:"text"},{key:"kind",label:"Kind",options:Object.keys(KINDS)},{key:"price",label:"OTC price ($)",type:"number"},{key:"fees",label:"Fees ($)",type:"number"},
    {key:"liens",label:"Other liens total ($)",type:"number"},{key:"landUse",label:"Property type",type:"text"},{key:"acres",label:"Acres",type:"text"},{key:"deadline",label:"Deadline",type:"date"},
    {key:"next",label:"Next step",type:"text"},{key:"appraised",label:"County appraised value ($)",type:"number"}],
  getDb:()=>dbRef, getMcp:async()=>claude.use("mcp").catch(()=>null), toast,
  ready:()=>!!col&&rows.length>0,
  current:()=>{const r=rows.find(x=>x.id===advSel);return r?{id:r.id,title:[r.address||("Parcel "+(r.apn||"")),r.city,r.state].filter(Boolean).join(", ")}:null},
  getField:k=>{const r=rows.find(x=>x.id===advSel);return r?r[k]:null},
  select:id=>{advSel=id},
  context:id=>{const r=rows.find(x=>x.id===id);if(!r)return{};const s=score(r);
    return{parcel:r,buyBox:bb,buyBoxResult:{verdict:VERDICT[s.verdict],tests:s.tests.map(t=>`${t.st.toUpperCase()}: ${t.label}${t.why?" ("+t.why+")":""}`),totalCost:s.cost.total,valueNeeded:s.need},
      kinds:KINDS,howToUse:"Harvey buys over-the-counter tax deeds/liens and Texas struck-off resale parcels that fit his buy box. Judge the parcel against the buy box, flag what is unverified (liens beyond mortgages: judgments, code liens, IRS; access; zoning; title/quiet title), and say what to check with the county before buying. A tax lien is not ownership; redemption rules vary by state. No legal advice."}},
  apply:async(id,patch)=>{
    if(readOnly||!col)throw new Error("You have view-only access here.");
    const r=rows.find(x=>x.id===id);if(!r)throw new Error("That parcel is gone.");
    const note=patch.__note;delete patch.__note;
    const body={};for(const [k,v] of Object.entries(patch))body[k]=NUMF.has(k)?num(v):String(v);
    if(body.appraised>0)body.fmv=DealAdvisor.fmv(body.appraised);
    if("liens" in body)body.liensSource="Deal Advisor";
    if(note)body.notes=(r.notes?String(r.notes).trimEnd()+"\n\n":"")+note;
    body.updated=new Date().toISOString();
    await col.doc(id).update(body);
  },
  hubIds:async id=>{try{const s=await dbRef.doc("hubmap/"+id).get();return s.exists?s.data():null}catch(_){return null}},
  findByHub:async hid=>{try{const s=await dbRef.collection("hubmap").get();const d=s.docs.find(x=>(x.data()||{}).hubId===hid);if(d&&rows.some(r=>r.id===d.id)){advSel=d.id;return d.id}return null}catch(_){return null}},
}):null;

/* ---------- start ---------- */
renderBB();render();
(async()=>{
  const db=window.claude?await window.claude.use("db"):null;
  if(!db){$("status").textContent="Sign in to claude.ai to view and update parcels.";readOnly=true;$("addBtn").hidden=true;render();return}
  col=db.collection("parcels");dbRef=db;
  db.doc("config/buybox").onSnapshot(s=>{if(s.exists){const d=s.data();bb={...DEF_BB,...d,kinds:[...(d.kinds||DEF_BB.kinds)],states:[...(d.states||[])]};bbSaved=d.updatedAt||null}renderBB();render()},()=>{});
  db.doc("runs/latest").onSnapshot(s=>{run=s.exists?s.data():null;renderRun()},()=>{});
  let ready=false;
  const kindOf=d=>KINDS[d.kind]?d.kind:"deed";
  const hub=hubSyncStart({
    db, track:"taxotc", app:"taxotc", collection:"parcels", label:"OTC Tax Parcel Finder", trackLabel:"OTC tax parcels", deadStage:"Pass",
    ready:()=>ready, getRecords:()=>rows, onStatus:t=>{$("hubStatus").textContent=t},
    toHub:r=>({name:r.name||r.address||("Parcel "+(r.apn||"")), address:r.address||"", zip:r.zip||"", county:r.county||"", city:r.city||"", state:r.state, prop_type:r.landUse||"", stage:STAGES.includes(r.stage)?r.stage:"Found", next_touch:r.date||"", asking:r.price,
      notes:[KINDS[r.kind]||"", r.apn&&"APN "+r.apn, r.deadline&&"Deadline "+r.deadline, r.liens!=null&&"Other liens $"+Math.round(r.liens).toLocaleString(), r.next&&"Next: "+r.next, r.url, r.notes].filter(Boolean).join("\n"),
      source:"OTC Tax Parcel Finder", data:{kind:r.kind||"", apn:r.apn||"", otcPrice:num(r.price), otherLiens:num(r.liens), deadline:r.deadline||"", verdict:VERDICT[score(r).verdict]}}),
    patchFromHub:(r,h)=>{
      const p={},fill=(k,v)=>{if(v!=null&&v!==""&&(r[k]==null||r[k]===""))p[k]=v};
      if(STAGES.includes(h.stage)&&h.stage!==(r.stage||"Found"))p.stage=h.stage;
      if(h.next_touch&&h.next_touch!==r.date)p.date=h.next_touch;
      if(h.asking!=null&&r.price==null)p.price=Number(h.asking);
      fill("city",h.city);fill("state",hubNormState(h.state));fill("address",h.address);fill("zip",hubZip5(h.zip));fill("county",h.county);fill("landUse",h.prop_type);
      if(Number(h.appraised)>0&&Number(h.appraised)!==Number(r.appraised)){p.appraised=Number(h.appraised);p.fmv=DealAdvisor.fmv(h.appraised)}
      if(Object.keys(p).length)p.updated=new Date().toISOString();
      return p;
    },
    fromHub:h=>{let d={};try{d=JSON.parse(h.data||"{}")||{}}catch(_){}
      const st=hubNormState(h.state)||hubZipState(h.zip)||"TX";
      return{name:h.name||h.address||"Back office parcel",address:h.address||"",zip:hubZip5(h.zip),county:h.county||"",city:h.city||"",state:st,kind:kindOf(d),apn:d.apn||"",
        price:h.asking!=null?Number(h.asking):(d.otcPrice??null),fees:null,liens:d.otherLiens??null,liensSource:d.otherLiens!=null?"back office":"",flood:{sfha:null},landUse:h.prop_type||"",acres:h.acres!=null?String(h.acres):"",
        deadline:d.deadline||"",stage:STAGES.includes(h.stage)?h.stage:"Found",date:h.next_touch||"",next:"",sourceName:"",url:"",notes:h.notes||"",source:"Back office",foundAt:new Date().toISOString(),updated:new Date().toISOString(),
        appraised:Number(h.appraised)>0?Number(h.appraised):null,fmv:Number(h.appraised)>0?DealAdvisor.fmv(h.appraised):null}},
  });
  $("hubBtn").onclick=()=>hub.sync();
  col.onSnapshot(s=>{rows=s.docs.map(d=>({id:d.id,...d.data()}));ready=true;hub.soon();$("status").textContent=`${rows.length} parcel${rows.length===1?"":"s"} · filter by result, stage, kind or state`;render()},
    ()=>{$("status").textContent="The dashboard lost its connection. Reload to reconnect."});
})();
</script>
