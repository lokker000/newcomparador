// Smoke test end-to-end: genera imágenes sintéticas de documentos, las manda
// a /api/extract (que llama a Gemini de verdad) y muestra el JSON extraído.
// Uso: node scripts/smoke-test.mjs   (con el dev server corriendo)
import sharp from "sharp";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function svg(lines) {
  const body = lines
    .map((t, i) => `<text x="40" y="${70 + i * 60}" font-size="34" font-family="Arial" fill="#111">${t}</text>`)
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${120 + lines.length * 60}">
       <rect width="100%" height="100%" fill="#fff"/>${body}</svg>`,
  );
}

async function png(lines) {
  return sharp(svg(lines)).png().toBuffer();
}

const docs = {
  cedula_frente: ["REPUBLICA DE CHILE", "Nombres: JUAN ANDRES", "Apellidos: PEREZ SOTO", "RUN: 12.345.678-5"],
  cedula_reverso: ["Fecha de vencimiento: 15 ENE 2030", "Numero documento: 123456789"],
  formulario: [
    "SOLICITUD SUBDIVISION PREDIOS RUSTICOS",
    "Solicitante: JUAN ANDRES PEREZ SOTO",
    "RUN: 12.345.678-5",
    "Rol: 234-56",
    "Superficie: 5,2 ha",
    "Comuna: MELIPILLA",
  ],
  avaluo: ["CERTIFICADO AVALUO FISCAL - SII", "Propietario: JUAN PEREZ SOTO", "Rol: 234-56", "Comuna: MELIPILLA", "Superficie: 52000 m2"],
  cbr: ["CONSERVADOR DE BIENES RAICES", "Propietario: JUAN ANDRES PEREZ SOTO", "Fojas: 1234 N 567 Año 2019", "Rol: 234-56", "Comuna: MELIPILLA", "Superficie: 5,2 hectareas"],
};

const form = new FormData();
for (const [k, lines] of Object.entries(docs)) {
  const buf = await png(lines);
  form.append(k, new Blob([buf], { type: "image/png" }), `${k}.png`);
}

console.log("POST /api/extract ...");
const res = await fetch(`${BASE}/api/extract`, { method: "POST", body: form });
console.log("HTTP", res.status);
const data = await res.json();
console.dir(data, { depth: 5 });
