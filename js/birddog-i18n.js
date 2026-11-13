// English/Spanish text for the Bird-Dog Program pages (bird-dog.html and bird-dog-portal.html).
// Elements with data-t="key" get T[key] (HTML); data-ph="key" sets a placeholder; data-en/data-es swap text.
// Language: ?lang=, else the saved choice (hll_lang, shared with the rest of the site), else the browser language.
(function () {
  var T = {
    nav_how: ["How it works", "Cómo funciona"], nav_rules: ["What qualifies", "Qué califica"], nav_join: ["Sign up", "Registrarse"], nav_terms: ["Terms", "Términos"],
    tag: ["Bird-Dog Program · Texas", "Programa de Referidos · Texas"],
    h1: ["Know someone who needs to sell? <em>Get paid $500.</em>", "¿Conoce a alguien que necesita vender? <em>Gane $500.</em>"],
    sub: ["Refer a Texas homeowner who wants to sell, and House Lot &amp; Land pays you a flat $500 when the deal funds. No license, no listing, no selling. Just talk to the owner, snap a photo and send it in.",
      "Refiera a un dueño de casa en Texas que quiere vender, y House Lot &amp; Land le paga $500 fijos cuando el trato se cierra y se financia. Sin licencia, sin listados, sin vender. Solo hable con el dueño, tome una foto y envíela."],
    cta: ["Sign up free", "Regístrese gratis"], t1: ["Flat $500 per funded deal", "$500 fijos por trato cerrado"], t2: ["Track every lead online", "Siga cada referido en línea"], t3: ["English or Spanish", "Inglés o español"],
    card_h: ["per deal that funds", "por cada trato que se cierra"],
    c1: ["Any deal type: cash purchase, assignment, subject-to or seller finance", "Cualquier tipo de trato: compra en efectivo, asignación, subject-to o financiamiento del dueño"],
    c2: ["No cap. Send as many good leads as you find", "Sin límite. Envíe todos los buenos referidos que encuentre"],
    c3: ["Your lead is protected for 12 months once we verify it", "Su referido queda protegido 12 meses después de verificarlo"],
    c4: ["Paid within 10 business days after funding", "Pago dentro de 10 días hábiles después del cierre"],
    fine: ["Texas properties only for now. Closed for Shabbat, sunset Friday to sunset Saturday.", "Por ahora solo propiedades en Texas. Cerrado por el Shabat, de la puesta del sol del viernes a la del sábado."],
    how: ["How it works", "Cómo funciona"], how_h: ["From conversation to cash", "De la conversación al pago"],
    s1h: ["Sign up", "Regístrese"], s1: ["Two minutes. You get a private link to your own bird-dog page.", "Dos minutos. Recibe un enlace privado a su propia página."],
    s2h: ["Talk to the owner", "Hable con el dueño"], s2: ["Find out why they want to sell and get their OK for us to contact them.", "Averigüe por qué quiere vender y obtenga su permiso para que lo contactemos."],
    s3h: ["Send the lead", "Envíe el referido"], s3: ["Address, owner's name and phone, their reason, and at least one photo.", "Dirección, nombre y teléfono del dueño, su razón y al menos una foto."],
    s4h: ["Get paid", "Cobre"], s4: ["We verify it and work the deal. When it funds at the title company, you get $500.", "Lo verificamos y trabajamos el trato. Cuando se cierra en la compañía de títulos, recibe $500."],
    r_e: ["What qualifies", "Qué califica"], r_h: ["A verified motivated seller, in 4 checks", "Un vendedor motivado verificado, en 4 puntos"],
    r1h: ["You spoke with the owner", "Habló con el dueño"], r1: ["In the last 30 days you talked with the owner (or an heir, executor or spouse), and they agreed House Lot &amp; Land may contact them.", "En los últimos 30 días habló con el dueño (o un heredero, albacea o cónyuge), y aceptó que House Lot &amp; Land lo contacte."],
    r2h: ["They have a reason to sell", "Tiene una razón para vender"], r2: ["Foreclosure, back taxes, inherited, vacant, major repairs, divorce, relocation, tired landlord, code violations and the like.", "Ejecución hipotecaria, impuestos atrasados, herencia, casa vacía, reparaciones mayores, divorcio, mudanza, arrendador cansado, infracciones del código y similares."],
    r3h: ["You took a photo", "Tomó una foto"], r3: ["At least one current photo of the property, taken from the street or with the owner's permission. Never trespass.", "Al menos una foto actual de la propiedad, tomada desde la calle o con permiso del dueño. Nunca entre sin permiso."],
    r4h: ["It's new to us", "Es nueva para nosotros"], r4: ["Not already in our system and not sent first by another bird-dog. Every lead is time-stamped, so first in wins.", "No está en nuestro sistema ni la envió antes otro participante. Cada referido lleva fecha y hora: el primero gana."],
    f_e: ["Sign up", "Registro"], f_h: ["Join the Bird-Dog Program", "Únase al Programa de Referidos"],
    f_have: ["Already signed up? Open the private link we gave you. Lost it? Call or text 214-702-1519.", "¿Ya se registró? Abra el enlace privado que le dimos. ¿Lo perdió? Llame o escriba al 214-702-1519."],
    name: ["Full name", "Nombre completo"], phone: ["Mobile phone", "Celular"], email: ["Email", "Correo electrónico"], city: ["City", "Ciudad"], zip: ["ZIP", "Código postal"],
    lic: ["I hold a real estate license.", "Tengo licencia de bienes raíces."], broker: ["Sponsoring broker (name and license number)", "Corredor patrocinador (nombre y número de licencia)"],
    adult: ["I am 18 or older.", "Tengo 18 años o más."],
    agree: ["I have read and agree to the <a href=\"#terms\">Bird-Dog Program Terms</a>. I understand I'm an independent referral source, not an employee or agent of House Lot &amp; Land, and that a W-9 is required before any payout.",
      "He leído y acepto los <a href=\"#terms\">Términos del Programa de Referidos</a>. Entiendo que soy una fuente de referidos independiente, no empleado ni agente de House Lot &amp; Land, y que se requiere un W-9 antes de cualquier pago."],
    consent: ["House Lot &amp; Land Sales Co. LLC may call or text me at the number above about my leads and payouts. Message and data rates may apply. Reply STOP to opt out.",
      "House Lot &amp; Land Sales Co. LLC puede llamarme o enviarme mensajes de texto al número de arriba sobre mis referidos y pagos. Pueden aplicar tarifas de mensajes y datos. Responda ALTO para dejar de recibirlos."],
    send: ["Sign me up", "Registrarme"], sending: ["Sending…", "Enviando…"],
    err_req: ["Please complete the required fields.", "Complete los campos obligatorios."], err_net: ["Something went wrong. Please call 214-702-1519.", "Algo salió mal. Llame al 214-702-1519."],
    done_h: ["You're in!", "¡Ya está registrado!"], done_p: ["Your bird-dog number is", "Su número de participante es"],
    done_l: ["This is your private link. Use it to send leads and track your payouts:", "Este es su enlace privado. Úselo para enviar referidos y ver sus pagos:"],
    done_w: ["Bookmark or save this link now. Anyone with it can send leads in your name, so don't share it.", "Guarde este enlace ahora. Cualquiera que lo tenga puede enviar referidos a su nombre, así que no lo comparta."],
    copy: ["Copy", "Copiar"], copied: ["Copied", "Copiado"], open: ["Send my first lead", "Enviar mi primer referido"],
    again: ["You're already signed up with this phone number. For your security we don't show your private link here. Call or text 214-702-1519 and we'll send it again.",
      "Ya está registrado con este número. Por su seguridad no mostramos su enlace privado aquí. Llame o escriba al 214-702-1519 y se lo enviamos de nuevo."],
    q_e: ["Questions", "Preguntas"],
    q1: ["When exactly do I get paid?", "¿Cuándo exactamente me pagan?"],
    a1: ["When the deal for your lead funds at the title company and House Lot &amp; Land receives its funds, we pay you $500 within 10 business days (by Zelle, check or another method we agree on). Your page shows each step: submitted, verified, funded, paid.",
      "Cuando el trato de su referido se cierra en la compañía de títulos y House Lot &amp; Land recibe sus fondos, le pagamos $500 dentro de 10 días hábiles (por Zelle, cheque u otro método acordado). Su página muestra cada paso: enviado, verificado, cerrado, pagado."],
    q2: ["What if the deal never closes?", "¿Y si el trato nunca se cierra?"],
    a2: ["Then there's no payout. Many sellers change their minds; that's why the payout is tied to funding. Your lead stays protected for 12 months after we verify it, so if it closes later in that window, you're still paid.",
      "Entonces no hay pago. Muchos vendedores cambian de opinión; por eso el pago depende del cierre. Su referido queda protegido 12 meses después de verificarlo, así que si se cierra en ese plazo, igual le pagamos."],
    q3: ["What should I say to the owner?", "¿Qué le digo al dueño?"],
    a3: ["Just that you know a local company that buys houses as-is and ask if it's OK for them to call. Don't quote prices, make promises, sign anything or say you work for us. We take it from there.",
      "Solo que conoce una compañía local que compra casas tal como están, y pregunte si está bien que lo llamen. No dé precios, no haga promesas, no firme nada ni diga que trabaja para nosotros. Nosotros seguimos desde ahí."],
    q4: ["Can I send a property that's listed with an agent?", "¿Puedo enviar una propiedad listada con un agente?"],
    a4: ["Generally no. We're looking for off-market owners. Expired or withdrawn listings are fine if the owner is no longer under a listing agreement.", "En general, no. Buscamos dueños fuera del mercado. Listados vencidos o retirados sí, si el dueño ya no tiene contrato con un agente."],
    q5: ["Do I need a license?", "¿Necesito licencia?"],
    a5: ["House Lot &amp; Land does not require one to join. If you are a licensed agent, tell us at sign-up: your fee is paid to your sponsoring broker, as Texas rules require.",
      "House Lot &amp; Land no la exige para participar. Si usted es agente con licencia, díganos al registrarse: su pago se hace a su corredor patrocinador, como exigen las reglas de Texas."],
    tm_e: ["Program terms", "Términos del programa"], tm_h: ["Bird-Dog Program Terms", "Términos del Programa de Referidos"], tm_v: ["Version 2026-11-13.", "Versión 2026-11-13. En caso de diferencia, rige la versión en inglés."],
    tm1: ["<b>Payout.</b> House Lot &amp; Land Sales Co. LLC (\"we\") pays a flat $500 for each Qualified Lead that results in a Funded Deal. One payout per property, no matter how many deals or people are involved. The amount does not depend on the price or our profit.",
      "<b>Pago.</b> House Lot &amp; Land Sales Co. LLC (\"nosotros\") paga $500 fijos por cada Referido Calificado que resulte en un Trato Cerrado. Un pago por propiedad, sin importar cuántos tratos o personas participen. El monto no depende del precio ni de nuestra ganancia."],
    tm2: ["<b>Qualified Lead.</b> A lead qualifies only if all of these are true when you submit it: (a) the property is in Texas; (b) within the last 30 days you personally spoke with the owner, or an heir, executor or spouse with authority over the property; (c) that person agreed House Lot &amp; Land may contact them; (d) you give a real reason the owner wants to sell; (e) you attach at least one current photo you took of the property; and (f) the property is not already in our system and was not submitted earlier by another bird-dog. We decide whether a lead qualifies after we verify it, and we may reject any lead, with the reason shown on your page.",
      "<b>Referido Calificado.</b> Un referido califica solo si todo esto es cierto al enviarlo: (a) la propiedad está en Texas; (b) en los últimos 30 días usted habló personalmente con el dueño, o con un heredero, albacea o cónyuge con autoridad sobre la propiedad; (c) esa persona aceptó que House Lot &amp; Land la contacte; (d) usted da una razón real por la que el dueño quiere vender; (e) adjunta al menos una foto actual que usted tomó de la propiedad; y (f) la propiedad no está ya en nuestro sistema ni la envió antes otro participante. Decidimos si un referido califica después de verificarlo, y podemos rechazar cualquier referido, con la razón en su página."],
    tm3: ["<b>Funded Deal.</b> A Funded Deal is a purchase, assignment, double close, subject-to or seller-financed acquisition of the property by us or our assignee that closes and funds through a title company within 12 months after we verify your lead. We pay within 10 business days after we receive our funds.",
      "<b>Trato Cerrado.</b> Un Trato Cerrado es una compra, asignación, doble cierre, subject-to o adquisición con financiamiento del dueño de la propiedad, por nosotros o nuestro cesionario, que se cierra y financia en una compañía de títulos dentro de los 12 meses después de verificar su referido. Pagamos dentro de 10 días hábiles después de recibir nuestros fondos."],
    tm4: ["<b>What you may and may not do.</b> You only introduce us to the owner. You may not make or discuss offers or prices, negotiate, sign or deliver documents, advertise or market any property, or say that you represent us or the owner. Never trespass, pressure anyone, or contact anyone who has asked not to be contacted. Information you send must be true and gathered lawfully.",
      "<b>Lo que puede y no puede hacer.</b> Usted solo nos presenta al dueño. No puede hacer ni hablar de ofertas o precios, negociar, firmar o entregar documentos, anunciar ninguna propiedad, ni decir que nos representa a nosotros o al dueño. Nunca entre sin permiso, no presione a nadie ni contacte a quien pidió no ser contactado. La información que envíe debe ser verdadera y obtenida legalmente."],
    tm5: ["<b>Independent referral source.</b> You are not our employee, agent or partner, and you have no authority to bind us. You are responsible for your own taxes and expenses. We need a completed W-9 (through a secure link we send) before any payout, and we issue tax forms as the IRS requires.",
      "<b>Fuente de referidos independiente.</b> Usted no es nuestro empleado, agente ni socio, y no tiene autoridad para obligarnos. Es responsable de sus propios impuestos y gastos. Necesitamos un W-9 completo (por un enlace seguro que le enviamos) antes de cualquier pago, y emitimos formularios de impuestos según lo exija el IRS."],
    tm6: ["<b>Licensed agents.</b> If you hold a real estate license, you must tell us, and any fee is paid to your sponsoring broker, not to you directly.", "<b>Agentes con licencia.</b> Si tiene licencia de bienes raíces, debe decírnoslo, y cualquier pago se hace a su corredor patrocinador, no a usted directamente."],
    tm7: ["<b>Your private link.</b> Your bird-dog page link is your key. Keep it private. You're responsible for leads sent with it; call us if you think someone else has it and we'll replace it.", "<b>Su enlace privado.</b> El enlace de su página es su llave. Manténgalo privado. Usted responde por los referidos enviados con él; llámenos si cree que alguien más lo tiene y lo cambiamos."],
    tm8: ["<b>Shabbat.</b> We are closed for all business from sunset Friday to sunset Saturday. Leads can't be submitted during that time.", "<b>Shabat.</b> Cerramos todo negocio desde la puesta del sol del viernes hasta la del sábado. No se pueden enviar referidos en ese tiempo."],
    tm9: ["<b>Changes.</b> We may change or end this program at any time for future leads. Leads we have already verified keep the terms in effect when you submitted them. You must be 18 or older to take part. Our <a href=\"terms.html\">Terms of Use</a> and <a href=\"privacy.html\">Privacy Policy</a> also apply.",
      "<b>Cambios.</b> Podemos cambiar o terminar este programa en cualquier momento para referidos futuros. Los referidos ya verificados mantienen los términos vigentes cuando los envió. Debe tener 18 años o más para participar. También aplican nuestros <a href=\"terms.html\">Términos de uso</a> y nuestra <a href=\"privacy.html\">Política de privacidad</a>."],

    // ---- portal ----
    p_tag: ["Your bird-dog page", "Su página de referidos"], p_hi: ["Welcome back", "Bienvenido"], p_loading: ["Loading…", "Cargando…"],
    p_bad: ["This link isn't active. Call or text 214-702-1519 and we'll help.", "Este enlace no está activo. Llame o escriba al 214-702-1519 y le ayudamos."],
    p_paused: ["Your account is paused, so new leads can't be sent. Call or text 214-702-1519.", "Su cuenta está en pausa, así que no puede enviar referidos. Llame o escriba al 214-702-1519."],
    p_w9: ["We need your W-9 before we can pay you. Watch for our secure link, or call 214-702-1519.", "Necesitamos su W-9 antes de pagarle. Espere nuestro enlace seguro o llame al 214-702-1519."],
    k_sub: ["Submitted", "Enviados"], k_ver: ["Verified", "Verificados"], k_owed: ["Owed to you", "Por pagarle"], k_paid: ["Paid to you", "Pagado"],
    l_h: ["Send a lead", "Enviar un referido"], l_prop: ["The property", "La propiedad"],
    addr: ["Street address", "Dirección"], ptype: ["Type", "Tipo"], asking: ["Price the owner mentioned (optional)", "Precio que mencionó el dueño (opcional)"],
    l_owner: ["Who you spoke with", "Con quién habló"], oname: ["Their name", "Su nombre"], ophone: ["Their phone", "Su teléfono"], oemail: ["Their email (optional)", "Su correo (opcional)"],
    rel: ["They are the…", "Esta persona es…"], spoke: ["Date you spoke with them", "Fecha en que habló con ellos"],
    l_why: ["Why they want to sell", "Por qué quiere vender"], sit: ["What's going on? (a few lines)", "¿Qué está pasando? (unas líneas)"],
    sit_ph: ["Behind 3 months, owner moved to Houston, roof leaks, wants to close by spring…", "Atrasado 3 meses, el dueño se mudó a Houston, el techo gotea, quiere cerrar en primavera…"],
    l_photos: ["Photos (1 to 4)", "Fotos (1 a 4)"], photos_hint: ["Take them from the street or with the owner's OK. Photos are shrunk automatically.", "Tómelas desde la calle o con permiso del dueño. Las fotos se reducen automáticamente."],
    owner_ok: ["The owner (or the person I spoke with) agreed that House Lot &amp; Land may call or text them about selling.", "El dueño (o la persona con quien hablé) aceptó que House Lot &amp; Land lo llame o le escriba sobre vender."],
    attest: ["Everything here is true. I spoke with this person myself, I did not make offers or promises, and I took these photos without trespassing.", "Todo esto es verdad. Hablé con esta persona yo mismo, no hice ofertas ni promesas, y tomé estas fotos sin entrar sin permiso."],
    l_send: ["Send this lead", "Enviar este referido"],
    l_ok: ["Lead received. Reference", "Referido recibido. Referencia"], l_dup: ["Not eligible:", "No califica:"],
    my_h: ["Your leads", "Sus referidos"], my_none: ["No leads yet. Your first one is waiting out there!", "Aún no hay referidos. ¡El primero le espera!"],
    st_submitted: ["Submitted: we're verifying", "Enviado: lo estamos verificando"], st_verified: ["Verified: we're working the deal", "Verificado: estamos trabajando el trato"],
    st_closed: ["Funded: $500 on the way", "Cerrado: $500 en camino"], st_paid: ["Paid", "Pagado"], st_rejected: ["Not eligible", "No califica"],
    th_prop: ["Property", "Propiedad"], th_sent: ["Sent", "Enviado"], th_status: ["Status", "Estado"],
    rel_owner: ["Owner", "Dueño"], rel_heir: ["Heir", "Heredero"], rel_executor: ["Executor", "Albacea"], rel_spouse: ["Spouse", "Cónyuge"], rel_other: ["Other (explain below)", "Otro (explique abajo)"],
    choose: ["Choose…", "Elija…"], terms_link: ["Program terms", "Términos del programa"],
  };
  var KEY = "hll_lang", cur = "en";
  try { var q = new URLSearchParams(location.search).get("lang"); if (q === "es" || q === "en") cur = q; else { var v = localStorage.getItem(KEY); if (v === "es" || v === "en") cur = v; else if ((navigator.language || "").toLowerCase().indexOf("es") === 0) cur = "es"; } } catch (e) {}
  function t(k) { var x = T[k]; return x ? x[cur === "es" ? 1 : 0] : k; }
  var titles = ["", ""], listeners = [];
  function apply(l) {
    cur = l === "es" ? "es" : "en"; document.documentElement.lang = cur;
    document.querySelectorAll("[data-t]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-t")); });
    document.querySelectorAll("[data-ph]").forEach(function (el) { el.placeholder = t(el.getAttribute("data-ph")); });
    document.querySelectorAll("[data-en]").forEach(function (el) { el.textContent = el.getAttribute("data-" + cur); });
    document.querySelectorAll("[data-l]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-l") === cur); });
    if (titles[0]) document.title = cur === "es" ? titles[1] : titles[0];
    try { localStorage.setItem(KEY, cur); } catch (e) {}
    listeners.forEach(function (fn) { fn(cur); });
  }
  window.hllBirddogLang = function (en, es) {
    titles = [en, es];
    document.querySelectorAll("[data-l]").forEach(function (b) { b.addEventListener("click", function () { apply(b.getAttribute("data-l")); }); });
    apply(cur);
    return { t: t, cur: function () { return cur; }, onChange: function (fn) { listeners.push(fn); }, apply: apply };
  };
})();
