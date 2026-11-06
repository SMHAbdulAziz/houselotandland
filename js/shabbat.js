// Shabbat hours for House Lot & Land Sales Co. LLC.
// The business is closed from sunset Friday to sunset Saturday every week, without exception.
// Sunset is computed for Dallas, Texas (NOAA-style solar calculation, accurate to about a minute).
// Shared by the browser (banner, forms) and the Worker (server-side enforcement). No dependencies.

export const PLACE = { name: "Dallas, Texas", lat: 32.7767, lon: -96.797 };
export const TZ = "America/Chicago";

const RAD = Math.PI / 180;

/** Sunset (a Date, UTC instant) for a local calendar date "YYYY-MM-DD" at PLACE. */
export function sunset(ymd, place = PLACE) {
  const [y, m, d] = ymd.split("-").map(Number);
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const jStar = n - place.lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(place.lat * RAD) * sinDec) / (Math.cos(place.lat * RAD) * cosDec);
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / RAD;
  const jSet = jTransit + w / 360;
  return new Date(Math.round(((jSet - 2440587.5) * 86400000) / 60000) * 60000); // whole minute
}

/** Local calendar date "YYYY-MM-DD" in Central time. */
export function localDate(t = new Date()) {
  return t.toLocaleDateString("en-CA", { timeZone: TZ });
}
/** Day of week 0=Sun … 6=Sat for a "YYYY-MM-DD" calendar date. */
export function weekday(ymd) {
  return new Date(ymd + "T12:00:00Z").getUTCDay();
}
export function addDays(ymd, n) {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Is the business closed right now?
 * Returns { closed, opensAt, closesAt } — opensAt is the Saturday sunset when closed;
 * closesAt is the next Friday sunset when open.
 */
export function shabbatStatus(now = new Date()) {
  const today = localDate(now), wd = weekday(today);
  if (wd === 5) {
    const fri = sunset(today);
    if (now >= fri) return { closed: true, opensAt: sunset(addDays(today, 1)), closesAt: fri };
    return { closed: false, closesAt: fri, opensAt: sunset(addDays(today, 1)) };
  }
  if (wd === 6) {
    const sat = sunset(today);
    if (now < sat) return { closed: true, opensAt: sat, closesAt: sunset(addDays(today, -1)) };
    return { closed: false, closesAt: sunset(addDays(today, 6)), opensAt: sunset(addDays(today, 7)) };
  }
  const fri = addDays(today, 5 - wd);
  return { closed: false, closesAt: sunset(fri), opensAt: sunset(addDays(fri, 1)) };
}

/** True when a work date ("YYYY-MM-DD") falls on Shabbat (Saturday). */
export function isShabbatDate(ymd) {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd || "") && weekday(ymd) === 6;
}

/** "Sat, Nov 7 at 5:28 PM" in Central time. */
export function fmtTime(t, lang = "en") {
  const loc = lang === "es" ? "es-US" : "en-US";
  const day = t.toLocaleDateString(loc, { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
  const time = t.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit", timeZone: TZ });
  return lang === "es" ? `${day} a las ${time}` : `${day} at ${time}`;
}

/** Bilingual message used by the server when a new-business action is refused. */
export function closedMessage(st = shabbatStatus()) {
  return `We're closed for Shabbat, from sunset Friday to sunset Saturday. We open again ${fmtTime(st.opensAt)} Central time. Please come back then. ` +
    `/ Estamos cerrados por el Shabat, desde la puesta del sol del viernes hasta la del sábado. Abrimos de nuevo el ${fmtTime(st.opensAt, "es")} (hora central).`;
}
