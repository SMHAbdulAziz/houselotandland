// Email drafts for owners and families, by track. Opened in Gmail (houselotandland@gmail.com) for Harvey to review and send;
// nothing here sends on its own. Every draft carries the mailing address and an opt-out line (CAN-SPAM).
// Fields: {greeting} {property} {property_short} {in_name} {my_name} {company} {phone} {mail_address}

const SIGN = {
  en: "With sympathy,\n{my_name}\n{company}\n{phone}\n\n—\n{mail_address}\nIf you'd rather not hear from us, reply \"remove\" and we won't contact you again.",
  es: "Con nuestro más sentido pésame,\n{my_name}\n{company}\n{phone}\n\n—\n{mail_address}\nSi prefiere que no le contactemos, responda \"no\" y no le escribiremos más.",
};
const NOT_YOU = {
  en: "There's no pressure and no obligation, and if the timing isn't right, I understand. If you're not the person handling the estate, I'd be grateful if you could pass this along to whoever is.",
  es: "No hay presión ni compromiso, y si no es el momento, lo entiendo. Si usted no es la persona que se encarga de la herencia, le agradecería que le hiciera llegar este mensaje a quien corresponda.",
};

export const OWNER_TEMPLATES = {
  "wholesale:deceased": {
    track: "wholesale", label: "Owner has passed away: cash offer, as-is",
    en: { subject: "About {property_short}", body: `{greeting}

I'm sorry for your loss. I'm reaching out about the property at {property}, which public records still show {in_name}.

Taking care of a loved one's home can be a lot: deciding what to keep, paying the taxes and insurance, keeping up the yard, and sorting out the paperwork. If the family is considering selling, {company} buys properties as-is, for cash:

- No repairs, cleaning, or clearing out belongings
- No agent commissions, and we pay our share of the closing costs
- A closing date that works for the family, including after probate or the estate paperwork is finished
- We close with a title company that handles estate sales, so the title passes correctly

${NOT_YOU.en}

If you'd like to talk, or would like a written cash offer, reply to this email or call me at {phone}.

${SIGN.en}` },
    es: { subject: "Sobre la propiedad en {property_short}", body: `{greeting}

Lamento mucho su pérdida. Le escribo sobre la propiedad en {property}, que según los registros públicos todavía está {in_name}.

Hacerse cargo de la casa de un ser querido puede ser mucho: decidir qué conservar, pagar impuestos y seguro, mantener el jardín y arreglar los papeles. Si la familia está pensando en vender, {company} compra propiedades en su estado actual y al contado:

- Sin reparaciones, limpieza ni sacar pertenencias
- Sin comisiones de agentes, y pagamos nuestra parte de los gastos de cierre
- Una fecha de cierre que le convenga a la familia, incluso después de terminar la sucesión (probate) o los trámites de la herencia
- Cerramos con una compañía de títulos que maneja ventas de herencias, para que el título se transfiera correctamente

${NOT_YOU.es}

Si desea hablar o recibir una oferta al contado por escrito, responda a este correo o llámeme al {phone}.

${SIGN.es}` },
  },
  "subto:deceased": {
    track: "subto", label: "Owner has passed away: take over the mortgage payments",
    en: { subject: "The mortgage on {property_short}", body: `{greeting}

I'm sorry for your loss. I'm reaching out about the property at {property}, which public records still show {in_name}.

When a homeowner passes away, the mortgage, taxes and insurance keep coming due while the family decides what to do, and missed payments can lead to foreclosure. If there's still a loan on the home and the family would like to be free of those payments, we may be able to help.

{company} can buy the home and take over the existing mortgage payments, keeping the loan current so the family isn't carrying the monthly cost. Depending on the situation, we can also:

- Bring past-due payments current
- Buy the home as-is, with no repairs or clean-out
- Work with the estate's timeline, including probate

The existing loan would stay in place, so before anything is signed we'd walk through exactly how that works with you and the estate's attorney or title company. Every situation depends on the loan and the estate; if you tell me a little about where things stand, I'll tell you plainly whether this is a fit.

${NOT_YOU.en}

Reply to this email or call me at {phone}.

${SIGN.en}` },
    es: { subject: "La hipoteca de {property_short}", body: `{greeting}

Lamento mucho su pérdida. Le escribo sobre la propiedad en {property}, que según los registros públicos todavía está {in_name}.

Cuando fallece el dueño de una casa, la hipoteca, los impuestos y el seguro siguen venciendo mientras la familia decide qué hacer, y los pagos atrasados pueden terminar en una ejecución hipotecaria (foreclosure). Si la casa todavía tiene un préstamo y la familia quiere librarse de esos pagos, quizás podamos ayudar.

{company} puede comprar la casa y hacerse cargo de los pagos de la hipoteca existente, manteniendo el préstamo al día para que la familia no cargue con el costo mensual. Según la situación, también podemos:

- Poner al día los pagos atrasados
- Comprar la casa en su estado actual, sin reparaciones ni limpieza
- Ajustarnos a los tiempos de la herencia, incluida la sucesión (probate)

El préstamo existente se mantendría, así que antes de firmar cualquier cosa le explicaríamos exactamente cómo funciona, a usted y al abogado de la herencia o a la compañía de títulos. Cada caso depende del préstamo y de la herencia; si me cuenta un poco cómo están las cosas, le diré con franqueza si esto le conviene.

${NOT_YOU.es}

Responda a este correo o llámeme al {phone}.

${SIGN.es}` },
  },
  "creative:deceased": {
    track: "creative", label: "Owner has passed away: monthly payments to the estate (seller financing)",
    en: { subject: "Options for {property_short}", body: `{greeting}

I'm sorry for your loss. I'm reaching out about the property at {property}, which public records still show {in_name}.

Some families would rather receive steady monthly payments than a single lump sum, especially when a property has been part of a loved one's income. {company} buys properties on flexible terms: part of the price at closing and the rest in monthly payments to the estate or heirs, secured by the property, at an agreed interest rate. That can mean:

- An agreed price, often higher than a quick cash sale, paid over time
- Monthly income for the estate or heirs
- We buy as-is and take over the day-to-day running of the property
- A closing date that fits the estate, including probate

How the payments are taxed depends on your situation, so please check with your tax adviser or the estate's attorney about what works best for your family. We can also make an all-cash offer if that's simpler.

${NOT_YOU.en}

Reply to this email or call me at {phone}.

${SIGN.en}` },
    es: { subject: "Opciones para {property_short}", body: `{greeting}

Lamento mucho su pérdida. Le escribo sobre la propiedad en {property}, que según los registros públicos todavía está {in_name}.

Algunas familias prefieren recibir pagos mensuales fijos en lugar de una sola suma, sobre todo cuando la propiedad era parte de los ingresos de su ser querido. {company} compra propiedades con términos flexibles: una parte del precio al cierre y el resto en pagos mensuales a la herencia o a los herederos, garantizados con la propiedad, a una tasa de interés acordada. Eso puede significar:

- Un precio acordado, a menudo más alto que una venta rápida al contado, pagado a plazos
- Ingresos mensuales para la herencia o los herederos
- Compramos en su estado actual y nos encargamos del manejo diario de la propiedad
- Una fecha de cierre que se ajuste a la herencia, incluida la sucesión (probate)

Los impuestos sobre los pagos dependen de su situación, así que consulte con su asesor de impuestos o con el abogado de la herencia qué le conviene más a su familia. También podemos hacer una oferta al contado si eso es más sencillo.

${NOT_YOU.es}

Responda a este correo o llámeme al {phone}.

${SIGN.es}` },
  },
};

/** Fill a template. v: {recipient, lateOwner, property, propertyShort, myName, company, phone, mailAddress} */
export function renderOwnerEmail(key, lang, v) {
  const t = OWNER_TEMPLATES[key]; if (!t) return null;
  const L = lang === "es" ? "es" : "en", T = t[L];
  const first = String(v.recipient || "").trim().split(/\s+/)[0] || "";
  const late = String(v.lateOwner || "").trim();
  const greeting = first ? (L === "es" ? `Hola ${first}:` : `Hi ${first},`)
    : late ? (L === "es" ? `A la familia de ${late}:` : `To the family of ${late},`) : (L === "es" ? "Hola:" : "Hello,");
  const in_name = late ? (L === "es" ? `a nombre de ${late}` : `in the name of ${late}`) : (L === "es" ? "a nombre de su ser querido" : "in your loved one's name");
  const f = { greeting, in_name, property: v.property || (L === "es" ? "su propiedad" : "your property"), property_short: v.propertyShort || v.property || (L === "es" ? "su propiedad" : "your property"),
    my_name: v.myName || "Harvey Searcy", company: v.company || "House Lot & Land Sales Co. LLC", phone: v.phone || "214-702-1519", mail_address: v.mailAddress || "" };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => (k in f ? f[k] : m));
  return { subject: fill(T.subject), body: fill(T.body).replace(/\n—\n\n/, "\n—\n").replace(/\n{3,}/g, "\n\n") };
}
