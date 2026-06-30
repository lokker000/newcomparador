# Verificador SAG — instrucciones del proyecto

App Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4 + Google Gemini (visión).
Verifica que el "Formulario de solicitud de certificación de subdivisión de predios
rústicos" coincida con sus documentos de respaldo (avalúo SII, CBR, cédula, e-RUT).
La IA solo extrae campos (JSON por documento) en `src/app/api/extract`; el motor de
reglas `src/lib/rules/engine.ts` cruza los datos. Datos sensibles: nada se persiste
(Ley 19.628).

## Subagentes a usar SIEMPRE en este proyecto

Para las tareas relevantes, delega de forma proactiva en estos subagentes (instalados
en `~/.claude/agents/`). Úsalos sin que haga falta pedirlo explícitamente:

**Núcleo del stack**
- `nextjs-developer` — trabajo con App Router, Server Components y rutas API.
- `typescript-pro` — tipos avanzados, genéricos, type-safety.
- `react-specialist` — componentes, estado y rendimiento React 19.
- `frontend-developer` — construcción de UI (DocumentUploader, ReportView, etc.).

**IA / Gemini**
- `prompt-engineer` — diseñar, optimizar o evaluar prompts (p. ej. `buildPrompt`).
- `ai-engineer` / `llm-architect` — arquitectura de la integración con el modelo.

**Calidad y seguridad (crítico: datos personales)**
- `code-reviewer` — revisar cambios antes de darlos por terminados.
- `security-auditor` — auditar flujos que manejan cédula/RUT y la API key.
- `architect-reviewer` — decisiones de diseño a nivel macro.
- `accessibility-tester` — accesibilidad WCAG de la UI.

**Soporte**
- `debugger`, `performance-engineer`, `refactoring-specialist`,
  `test-automator`, `qa-expert`, `api-designer`, `ui-designer` — según la tarea.

Regla práctica: si una tarea cae claramente en el dominio de uno de estos agentes,
úsalo en lugar de resolverlo de forma genérica.
