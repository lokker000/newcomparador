# Verificador SAG

Sistema web para verificar la **certificación de subdivisión de predios rústicos**.
Un operador sube los documentos de un cliente y el sistema comprueba que el
**Formulario de solicitud** coincida con los documentos de respaldo y que todo
esté **al día y vigente**.

No es un diff de texto: una **IA con visión (Google Gemini)** lee cada documento y
**extrae** los campos clave; un **motor de reglas** los cruza contra el formulario y
produce un **informe campo por campo** (✅ coincide / ❌ no coincide / ⚠️ difiere /
⛔ vencido / ❔ falta).

> La IA solo **extrae**. Las **reglas** (qué tiene que coincidir con qué) viven en el
> código → el sistema es predecible y auditable.

---

## Cómo correrlo

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar la API key (ya creado: .env.local)
#    Si no existe, copia el ejemplo y completa GEMINI_API_KEY:
cp .env.example .env.local

# 3. Desarrollo
npm run dev          # http://localhost:3000

# Otros
npm run build        # build de producción
npm run start        # servir el build
npm run typecheck    # chequear tipos
```

### API key de Gemini

- Consíguela gratis en <https://aistudio.google.com> (formato `AIzaSy...`).
- Va en `.env.local` como `GEMINI_API_KEY` (server-side, **nunca** en el navegador).
- El adaptador acepta tanto una API key (`?key=`) como un access token OAuth (`Bearer`).
- Modelo por defecto: `gemini-2.5-flash` (configurable con `GEMINI_MODEL`).

---

## Manejo de datos sensibles

Los documentos tienen datos personales (RUN, RUT, cédula). Decisión de diseño:

- Los archivos y datos extraídos viven **solo en el navegador** (estado de React).
- El servidor usa los archivos para llamar a la IA y **no los persiste** (sin disco, sin DB).
- **“Nueva comparación”** borra todo y deja listo el siguiente cliente.
- Encaja con la **Ley 19.628** de protección de datos (Chile): no guardar = menos riesgo.

---

## Arquitectura

```
src/
├─ app/
│  ├─ api/extract/route.ts   # POST: recibe archivos → IA → JSON (aquí vive la key)
│  ├─ layout.tsx · page.tsx · globals.css
├─ components/               # UI (wizard, uploader, informe, tema)
└─ lib/
   ├─ types.ts · documents.ts
   ├─ compare/               # normalización: texto, RUT, superficie, fechas
   ├─ extraction/schemas.ts  # qué campos saca la IA de cada documento
   ├─ gemini.ts              # adaptador de la IA (server-only)
   └─ rules/engine.ts        # ← la matriz de validación (el corazón)
```

### Flujo

1. Tipo de solicitante (natural / sociedad).
2. Subida de documentos (valida que no falte ninguno).
3. `/api/extract` manda cada documento a Gemini → JSON de campos.
4. `buildReport()` corre la matriz de reglas (en el navegador) → informe.
5. Exportar/imprimir PDF · “Nueva comparación” limpia todo.

### Matriz de validación (`src/lib/rules/engine.ts`)

| # | Qué se compara | Fuentes | Solo |
|---|----------------|---------|------|
| 1 | Identidad (nombre + RUN) | Formulario = Cédula = Avalúo/CBR | — |
| 2 | Rol del predio | Formulario = Avalúo = CBR | — |
| 3 | Superficie | Formulario = Avalúo = CBR (con tolerancia) | — |
| 4 | Ubicación / comuna | Formulario = Avalúo = CBR | — |
| 5 | Propietario vigente | CBR = solicitante | — |
| 6 | Cédula vigente | vencimiento > hoy | — |
| 7 | Razón social + RUT | Formulario = e-RUT | sociedad |
| 8 | Representante legal | Formulario = e-RUT / CBR | sociedad |

**Agregar un chequeo** = agregar una fila al arreglo `RULES`. No se reescribe nada más.

---

## Roadmap

- [x] **Fase 0** — Base Next.js + subida de archivos.
- [x] **Fase 1** — MVP de comparación (reglas 1–4).
- [x] **Fase 2** — CBR + cédula (reglas 5, 6).
- [x] **Fase 3** — Sociedades / e-RUT (reglas 7, 8).
- [x] **Fase 4** — Informe + exportar a PDF + veredicto general.
- [x] **Fase 5** — Modo oscuro, validaciones, README.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Google Gemini.
