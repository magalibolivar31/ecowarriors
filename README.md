# EcoWarriors

Plataforma web de **resiliencia urbana y acción ambiental comunitaria**.  
Permite reportar incidentes ambientales/críticos, coordinar cuadrillas, usar mercado solidario y operar con asistencia de IA.

---

## Arquitectura (visión general)

El proyecto está dividido en dos capas principales:

1. **Frontend SPA (Vite + React + TypeScript)** en la raíz:
   - `src/App.tsx`: orquestación principal (auth, navegación, flujos de reportes/comunidad/perfil/chat).
   - `src/services/*`: acceso a Firebase, lógica de dominio y flujos de negocio.
   - `src/lib/*`: utilidades puras (sanitización, validaciones, progreso de misiones, normalización de reportes).
   - `src/contexts/SettingsContext.tsx`: i18n ES/EN, preferencias de UI y modales globales.
2. **Backend serverless (Firebase Functions)** en `functions/`:
   - `functions/src/index.ts`: endpoints HTTP para análisis/validación/chat con Gemini.
   - `functions/src/lib/*`: utilidades HTTP/parseo y cliente Gemini para reutilización y testing.

Persistencia y storage se realizan sobre **Firebase Firestore + Storage**, con reglas en:
- `firestore.rules`
- `storage.rules`

---

## Stack técnico

- React 19 + Vite 6 + TypeScript
- Firebase (Auth, Firestore, Storage, Functions)
- Gemini (`@google/generative-ai`)
- Vitest (unit + integration + coverage) en frontend y functions
- GitHub Actions para CI/CD + deploy a GitHub Pages

---

## Requisitos

- Node.js 20+ para desarrollo local
- npm 10+
- Proyecto Firebase configurado
- Clave de Gemini

> Nota: el runtime configurado para Cloud Functions es Node 18 (`functions/package.json`), pero el desarrollo/tests locales se ejecutan correctamente con Node 20.

---

## Configuración de entorno

### 1) Frontend (`.env.local`)

Tomar como base `.env.example`:

```bash
cp .env.example .env.local
```

Variables requeridas:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GEMINI_API_KEY`

### 2) Functions

Las functions leen la clave desde:

1. `functions.config().gemini.key` (preferido en Firebase)
2. `process.env.GEMINI_API_KEY` (fallback local)

---

## Instalación

```bash
npm install
npm --prefix functions install
```

---

## Ejecutar en local

### Frontend

```bash
npm run dev
```

### Functions (emulador)

```bash
npm --prefix functions run serve
```

---

## Build y calidad

### Frontend

```bash
npm run lint
npm run build
```

### Functions

```bash
npm --prefix functions run build
```

---

## Testing

El proyecto usa **tests unitarios e integración** en ambas capas.

### Frontend

```bash
npm run test
npm run test:coverage
```

Ejecutar un archivo de test específico:

```bash
npm run test -- src/services/userService.test.ts
```

### Functions

```bash
npm --prefix functions run test
npm --prefix functions run test:coverage
```

Ejecutar un archivo de test específico:

```bash
npm --prefix functions run test -- src/index.integration.test.ts
```

---

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`

Pipeline actual:

1. Instala dependencias de raíz y de `functions/` (`npm ci` y `npm --prefix functions ci`)
2. Ejecuta lint/typecheck frontend (`npm run lint`)
3. Ejecuta tests frontend con cobertura (`npm run test:coverage`)
4. Ejecuta build de `functions/` (`npm --prefix functions run build`)
5. Ejecuta tests de `functions/` con cobertura (`npm --prefix functions run test:coverage`)
6. Ejecuta build frontend (`npm run build`)
7. Publica `dist/` en GitHub Pages

---

## Estructura de carpetas (alto nivel)

```text
.
├── src/                    # Frontend app
│   ├── components/
│   ├── contexts/
│   ├── lib/
│   ├── services/
│   └── integration/        # Tests de integración frontend
├── functions/              # Cloud Functions
│   └── src/
│       ├── lib/
│       └── index.ts
├── firestore.rules
├── storage.rules
└── .github/workflows/
```

---

## Estado actual de testing

- Frontend: suite de unit + integration activa con cobertura.
- Functions: suite de unit + integration activa con cobertura.
- Ambos paquetes se validan automáticamente en CI.
