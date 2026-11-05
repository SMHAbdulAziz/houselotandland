/* English / Español switch for houselotandland.org
 * Page text is written in English. This swaps visible text, placeholders and labels
 * to Spanish from the dictionary below, and remembers the visitor's choice.
 * Forms read window.hllLang() so leads are saved with the right language.
 * To add a string: copy the English exactly as it appears on the page (spacing doesn't matter).
 */
(function () {
  var ES = {
    "Home": "Inicio",
    "Services": "Servicios",
    "Investor Funding": "Inversionistas",
    "How It Works": "Cómo Funciona",
    "FAQ": "Preguntas",
    "Contact": "Contacto",
    "Find My Offer": "Ver Mi Oferta",
    "We Buy Houses": "Compramos Casas",
    "Fast": "Rápido",
    "and in Any Condition!": "y en Cualquier Condición",
    "Get a no-obligation cash offer for your house, lot, or land. We buy properties in any condition - vacant or occupied.": "Reciba una oferta en efectivo sin compromiso por su casa, lote o terreno. Compramos propiedades en cualquier condición, vacías u ocupadas.",
    "Get Cash Offer": "Obtener Oferta en Efectivo",
    "Call Now": "Llame Ahora",
    "Get Your Free Cash Offer": "Obtenga Su Oferta en Efectivo Gratis",
    "No Obligation • 24-Hour Response • As-Is Properties": "Sin Compromiso • Respuesta en 24 Horas • Propiedades Tal Como Están",
    "Full Name *": "Nombre Completo *",
    "Enter your full name": "Escriba su nombre completo",
    "Phone Number *": "Número de Teléfono *",
    "Phone Number": "Número de Teléfono",
    "Email Address *": "Correo Electrónico *",
    "Email Address": "Correo Electrónico",
    "your@email.com": "su@correo.com",
    "Property Address *": "Dirección de la Propiedad *",
    "Street address, city, state, ZIP": "Calle, ciudad, estado, código postal",
    "Property Type *": "Tipo de Propiedad *",
    "Select property type": "Seleccione el tipo de propiedad",
    "Single Family Home": "Casa Unifamiliar",
    "Multi-Family": "Multifamiliar",
    "Condo/Townhouse": "Condominio/Casa Adosada",
    "Land/Lot": "Terreno/Lote",
    "Commercial": "Comercial",
    "Other": "Otro",
    "Property Condition": "Condición de la Propiedad",
    "Select condition": "Seleccione la condición",
    "Excellent": "Excelente",
    "Good": "Buena",
    "Fair": "Regular",
    "Poor": "Mala",
    "Distressed": "Muy deteriorada",
    "When do you need to sell? *": "¿Cuándo necesita vender? *",
    "Select timeline": "Seleccione el plazo",
    "ASAP (within 30 days)": "Lo antes posible (en 30 días)",
    "1-3 months": "1 a 3 meses",
    "3-6 months": "3 a 6 meses",
    "6+ months": "Más de 6 meses",
    "Additional Details": "Detalles Adicionales",
    "Tell us more about your property, situation, or any questions you have...": "Cuéntenos más sobre su propiedad, su situación o cualquier pregunta que tenga...",
    "I agree that House Lot & Land Sales Co. LLC and its AI assistant may call or text me at the number above about my property, including by automated technology and an artificial or AI voice. Consent is not required to get an offer. Message and data rates may apply; reply STOP to opt out. This is a no-obligation offer request.":
      "Acepto que House Lot & Land Sales Co. LLC y su asistente de inteligencia artificial me llamen o me envíen mensajes de texto al número indicado sobre mi propiedad, incluso mediante tecnología automatizada y una voz artificial o de IA. El consentimiento no es un requisito para recibir una oferta. Pueden aplicarse tarifas de mensajes y datos; responda ALTO para cancelar. Esta es una solicitud de oferta sin compromiso.",
    "Get My Free Cash Offer": "Obtener Mi Oferta Gratis",
    "Your information is secure and will never be shared with third parties.": "Su información está segura y nunca se compartirá con terceros.",
    "Our Services": "Nuestros Servicios",
    "We provide comprehensive real estate solutions for property owners": "Ofrecemos soluciones inmobiliarias completas para dueños de propiedades",
    "Cash Offers": "Ofertas en Efectivo",
    "Get a fair, no-obligation cash offer for your property within 24 hours. No repairs needed!": "Reciba una oferta en efectivo justa y sin compromiso por su propiedad en 24 horas. ¡No necesita reparaciones!",
    "Distressed Properties": "Propiedades Deterioradas",
    "Don't worry about repairs or condition. We buy properties as-is, saving you time and money.": "No se preocupe por reparaciones ni por la condición. Compramos propiedades tal como están, ahorrándole tiempo y dinero.",
    "Land & Lots": "Terrenos y Lotes",
    "We buy vacant land, lots, and undeveloped properties for cash. Quick closing available.": "Compramos terrenos, lotes y propiedades sin desarrollar en efectivo. Cierre rápido disponible.",
    "Contract Drafting": "Redacción de Contratos",
    "Professional contract preparation and legal documentation for smooth property transactions.": "Preparación profesional de contratos y documentos para transacciones de propiedades sin complicaciones.",
    "Homestead Trust": "Fideicomiso de Vivienda (Homestead Trust)",
    "Protect your property with professional homestead trust preparation services.": "Proteja su propiedad con servicios profesionales de preparación de fideicomisos de vivienda.",
    "Vacant Property Watch": "Vigilancia de Propiedades Vacías",
    "Professional monitoring and maintenance services for vacant properties.": "Servicios profesionales de vigilancia y mantenimiento para propiedades vacías.",
    "Private Money Brokering": "Corretaje de Préstamos Privados",
    "Secure funding for your real estate investments. We connect investors with private lenders for fix-and-flip, rental properties, and wholesale deals.": "Consiga financiamiento para sus inversiones inmobiliarias. Conectamos a inversionistas con prestamistas privados para remodelar y vender, propiedades de renta y ventas al por mayor.",
    "Learn More →": "Más Información →",
    "Simple 3-step process to get your cash offer": "Un proceso sencillo de 3 pasos para obtener su oferta en efectivo",
    "Tell us about your property": "Cuéntenos sobre su propiedad",
    "Fill out our form or call us at 214-702-1519. Tell us about your property.": "Llene nuestro formulario o llámenos al 214-702-1519. Cuéntenos sobre su propiedad.",
    "Get Your Offer": "Reciba Su Oferta",
    "We'll provide you with a fair, no-obligation cash offer within 24 hours.": "Le daremos una oferta en efectivo justa y sin compromiso en 24 horas.",
    "Close Fast": "Cierre Rápido",
    "If you accept, we can close in as little as 7 days. No hidden fees!": "Si acepta, podemos cerrar en tan solo 7 días. ¡Sin cargos ocultos!",
    "Frequently Asked Questions": "Preguntas Frecuentes",
    "Get answers to common questions about selling your property": "Respuestas a preguntas comunes sobre la venta de su propiedad",
    "How quickly can I get a cash offer?": "¿Qué tan rápido puedo recibir una oferta en efectivo?",
    "We provide no-obligation cash offers within 24 hours of receiving your property information. The process is fast and straightforward.": "Le damos ofertas en efectivo sin compromiso dentro de las 24 horas de recibir la información de su propiedad. El proceso es rápido y sencillo.",
    "Do I need to make repairs before selling?": "¿Necesito hacer reparaciones antes de vender?",
    "No! We buy properties as-is. You don't need to make any repairs, clean up, or spend money fixing anything. We'll take care of everything.": "¡No! Compramos propiedades tal como están. No necesita hacer reparaciones, limpiar ni gastar dinero en arreglos. Nosotros nos encargamos de todo.",
    "What types of properties do you buy?": "¿Qué tipos de propiedades compran?",
    "We buy houses, lots, land, and distressed properties in any condition - whether they're vacant or occupied. No property is too damaged or too small for us to consider.": "Compramos casas, lotes, terrenos y propiedades deterioradas en cualquier condición, estén vacías u ocupadas. Ninguna propiedad es demasiado dañada ni demasiado pequeña para considerarla.",
    "How fast can we close?": "¿Qué tan rápido podemos cerrar?",
    "We can close in as little as 7 days, depending on your timeline and preferences. We work around your schedule.": "Podemos cerrar en tan solo 7 días, según su plazo y sus preferencias. Nos ajustamos a su horario.",
    "Is the cash offer really no-obligation?": "¿La oferta en efectivo realmente es sin compromiso?",
    "Yes! Our cash offers are completely no-obligation. You can review the offer, ask questions, and decide if it's right for you with no pressure.": "¡Sí! Nuestras ofertas en efectivo son completamente sin compromiso. Puede revisar la oferta, hacer preguntas y decidir si le conviene, sin presión.",
    "What areas do you serve?": "¿Qué áreas atienden?",
    "We serve the greater Dallas-Fort Worth area and surrounding communities. Contact us to see if we cover your specific location.": "Atendemos toda el área de Dallas-Fort Worth y comunidades cercanas. Contáctenos para saber si cubrimos su ubicación.",
    "Ready to Get Your Cash Offer?": "¿Listo para Recibir Su Oferta en Efectivo?",
    "Don't wait! Contact us today to get started with your no-obligation cash offer.": "¡No espere! Contáctenos hoy para comenzar con su oferta en efectivo sin compromiso.",
    "Contact Us": "Contáctenos",
    "Contact Info": "Información de Contacto",
    "Call Us": "Llámenos",
    "Email Us": "Escríbanos",
    "Response Time": "Tiempo de Respuesta",
    "Within 24 hours": "En menos de 24 horas",
    "Send Us a Message": "Envíenos un Mensaje",
    "Your Name": "Su Nombre",
    "Send Message": "Enviar Mensaje",
    "Limited Time Offer": "Oferta por Tiempo Limitado",
    "\"Got my offer in 2 hours and closed in 7 days!\" - Sarah M.": "\"¡Recibí mi oferta en 2 horas y cerré en 7 días!\" - Sarah M.",
    "Professional real estate solutions for property owners. We buy houses, lots, and land for cash.": "Soluciones inmobiliarias profesionales para dueños de propiedades. Compramos casas, lotes y terrenos en efectivo.",
    "Quick Links": "Enlaces Rápidos",
    "Follow Us": "Síganos",
    "© 2026 House Lot & Land Sales Co. LLC. All rights reserved.": "© 2026 House Lot & Land Sales Co. LLC. Todos los derechos reservados.",
    "Previous slide": "Diapositiva anterior",
    "Next slide": "Diapositiva siguiente",
    // Messages shown by the site's scripts
    "Sending...": "Enviando...",
    "Thank You!": "¡Gracias!",
    "We've received your information and will contact you within 24 hours with your cash offer.": "Recibimos su información y le contactaremos en 24 horas con su oferta en efectivo.",
    "What happens next?": "¿Qué sigue?",
    "You'll get a confirmation by email (and by text, if you agreed to texts) shortly.": "En breve recibirá una confirmación por correo (y por mensaje de texto, si lo aceptó).",
    "We'll review your property details": "Revisaremos los detalles de su propiedad",
    "You'll receive your offer options within 24 hours": "Recibirá sus opciones de oferta en 24 horas",
    "No obligation - you decide if the offer works for you": "Sin compromiso: usted decide si la oferta le conviene",
    "Your reference number:": "Su número de referencia:",
    "Thank you! Your message has been sent.": "¡Gracias! Su mensaje fue enviado.",
    "There was an error. Please try again.": "Hubo un error. Por favor intente de nuevo.",
    "Network error. Please try again later.": "Error de conexión. Por favor intente más tarde.",
    "Network error. Please call us at 214-702-1519 or try again later.": "Error de conexión. Llámenos al 214-702-1519 o intente más tarde.",
    "This field is required": "Este campo es obligatorio",
    "Please enter a valid email address": "Ingrese un correo electrónico válido",
    "Please enter a valid phone number": "Ingrese un número de teléfono válido",
  };

  var KEY = "hll_lang";
  var norm = function (s) { return String(s).replace(/\s+/g, " ").trim(); };
  var originals = new WeakMap(); // text node -> original English
  var attrOriginals = new WeakMap(); // element -> {attr: English}
  var current = "en";

  function pick() {
    try { var q = new URLSearchParams(location.search).get("lang"); if (q === "es" || q === "en") return q; } catch (e) {}
    try { var v = localStorage.getItem(KEY); if (v === "es" || v === "en") return v; } catch (e) {}
    return (navigator.language || "").toLowerCase().indexOf("es") === 0 ? "es" : "en";
  }

  function t(english) {
    if (current !== "es") return english;
    var v = ES[norm(english)];
    return v === undefined ? english : v;
  }

  function apply(lang) {
    current = lang === "es" ? "es" : "en";
    document.documentElement.lang = current;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === "SCRIPT" || p === "STYLE" || p === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    var n;
    while ((n = walker.nextNode())) {
      if (!originals.has(n)) originals.set(n, n.nodeValue);
      var en = originals.get(n), key = norm(en);
      var lead = en.match(/^\s*/)[0], trail = en.match(/\s*$/)[0];
      n.nodeValue = current === "es" && ES[key] !== undefined ? lead + ES[key] + trail : en;
    }
    document.querySelectorAll("[placeholder],[aria-label],[title],img[alt]").forEach(function (el) {
      var saved = attrOriginals.get(el) || {};
      ["placeholder", "aria-label", "title", "alt"].forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        if (!(a in saved)) saved[a] = el.getAttribute(a);
        var k = norm(saved[a]);
        el.setAttribute(a, current === "es" && ES[k] !== undefined ? ES[k] : saved[a]);
      });
      attrOriginals.set(el, saved);
    });
    document.querySelectorAll("[data-lang-toggle]").forEach(function (b) {
      b.textContent = current === "es" ? "English" : "Español";
      b.setAttribute("aria-label", current === "es" ? "View this site in English" : "Ver este sitio en español");
    });
    try { localStorage.setItem(KEY, current); } catch (e) {}
  }

  window.hllLang = function () { return current; };
  window.hllT = t;
  window.hllApplyLang = function () { apply(current); };

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-lang-toggle]");
    if (!b) return;
    e.preventDefault();
    apply(current === "es" ? "en" : "es");
  });

  function boot() { apply(pick()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
