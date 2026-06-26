// Verifica el motor de reglas con datos extraídos de ejemplo (caso conforme)
// y un par de casos con observaciones. Uso: npx tsx scripts/test-engine.ts
import { buildReport } from "../src/lib/rules/engine";
import type { ExtractedDocument } from "../src/lib/types";

function doc(docType: ExtractedDocument["docType"], f: Record<string, string | null>): ExtractedDocument {
  const fields: ExtractedDocument["fields"] = {};
  for (const [k, v] of Object.entries(f)) fields[k] = { value: v, legible: v !== null };
  return { docType, fileName: `${docType}.png`, fields };
}

// ── Caso 1: todo conforme ──────────────────────────────────────
const conforme: ExtractedDocument[] = [
  doc("cedula_frente", { nombre: "JUAN ANDRES", apellidos: "PEREZ SOTO", run: "12.345.678-5", fecha_nacimiento: null }),
  doc("cedula_reverso", { run: null, fecha_vencimiento: "15 ENE 2030", numero_documento: "123456789" }),
  doc("formulario", { tipo_solicitante: "natural", nombre_solicitante: "JUAN ANDRES PEREZ SOTO", run_solicitante: "12.345.678-5", razon_social: null, rut_empresa: null, representante_legal: null, rol_predio: "234-56", superficie: "5,2 ha", comuna: "MELIPILLA", ubicacion: null, region: null }),
  doc("avaluo", { rol_predio: "234-56", propietario: "JUAN PEREZ SOTO", comuna: "MELIPILLA", direccion: null, superficie: "52000 m2", avaluo_fiscal: null }),
  doc("cbr", { propietario: "JUAN ANDRES PEREZ SOTO", fojas: "1234", numero_inscripcion: "567", anio_inscripcion: "2019", rol_predio: "234-56", comuna: "MELIPILLA", superficie: "5,2 hectareas", deslindes: null, representante_legal: null }),
];

// ── Caso 2: cédula vencida + comuna distinta + superficie dispar ──
const observa: ExtractedDocument[] = [
  doc("cedula_frente", { nombre: "JUAN ANDRES", apellidos: "PEREZ SOTO", run: "12.345.678-5", fecha_nacimiento: null }),
  doc("cedula_reverso", { run: null, fecha_vencimiento: "15 ENE 2020", numero_documento: "1" }), // vencida
  doc("formulario", { tipo_solicitante: "natural", nombre_solicitante: "JUAN ANDRES PEREZ SOTO", run_solicitante: "12.345.678-5", razon_social: null, rut_empresa: null, representante_legal: null, rol_predio: "234-56", superficie: "5,2 ha", comuna: "MELIPILLA", ubicacion: null, region: null }),
  doc("avaluo", { rol_predio: "234-56", propietario: "JUAN PEREZ SOTO", comuna: "TALAGANTE", direccion: null, superficie: "80000 m2", avaluo_fiscal: null }), // comuna y superficie distintas
  doc("cbr", { propietario: "JUAN ANDRES PEREZ SOTO", fojas: "1234", numero_inscripcion: "567", anio_inscripcion: "2019", rol_predio: "234-56", comuna: "MELIPILLA", superficie: "5,2 hectareas", deslindes: null, representante_legal: null }),
];

for (const [titulo, docs] of [["CASO 1 (esperado: conforme)", conforme], ["CASO 2 (esperado: observaciones)", observa]] as const) {
  const r = buildReport(docs, "natural");
  console.log(`\n=== ${titulo} → ${r.veredicto.toUpperCase()} ===`);
  for (const res of r.results) console.log(`  #${res.id} ${res.status.padEnd(9)} ${res.label}`);
}
