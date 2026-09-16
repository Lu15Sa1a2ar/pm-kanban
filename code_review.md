# Code Review — Project Management MVP

Fecha: 2026-08-29
Alcance: repo completo (`backend/`, `frontend/`, `scripts/`, `Dockerfile`, `docker-compose.yml`, docs).
Método: lectura completa de todo el código fuente de producción (no solo el diff), tests, configuración de Docker y scripts de arranque/parada. Se excluyen `node_modules/`, `.venv/`, `.next/`, `out/`.

Estado general: la base de código es pequeña, coherente con `AGENTS.md`/`docs/PLAN.md`, y toda la suite de tests (backend, unit frontend, e2e mockeado, e2e integrado contra el contenedor real) pasa. Los hallazgos de abajo son mejoras concretas, no bloqueadores del MVP salvo el primero.

**Actualización 2026-08-29:** los ítems 1–6 (alta y media prioridad) fueron implementados y verificados. Detalle de verificación en cada sección. Los ítems 7–10 (baja prioridad) quedan pendientes.

## Alta prioridad

### 1. Los datos del tablero se pierden cada vez que se reinicia el stack con los scripts provistos
- **Dónde:** `docker-compose.yml` (sin sección `volumes`), `scripts/start.ps1:2`, `scripts/start.sh:4`, `scripts/start.bat:3`.
- **Problema:** el path por defecto de la base SQLite (`backend/data/project-management.db`) vive dentro de la capa de escritura del contenedor. Los tres scripts de arranque ejecutan `docker compose up --build`, lo cual reconstruye la imagen y **recrea el contenedor** en cada arranque. Verificado en esta sesión: un contenedor previo (7 días de antigüedad, con datos) fue reemplazado por uno nuevo al correr `docker compose up --build`, perdiendo cualquier cambio guardado en el tablero.
- **Impacto:** contradice directamente el requisito documentado en `docs/DATABASE.md` y `docs/PLAN.md` Parte 7 ("Board changes survive a page reload"). Sobrevive un *reload*, pero no un *restart* del contenedor, que es el flujo normal de uso (`stop` + `start`).
- **Acción:** montar un volumen persistente para el directorio de datos, por ejemplo:
  ```yaml
  services:
    app:
      volumes:
        - ./backend/data:/app/data
  ```
  y documentar en `docs/DATABASE.md` que el volumen es requerido para persistencia real.
- **✅ Resuelto:** volumen agregado en `docker-compose.yml`. Verificado en vivo: se creó una tarjeta, se corrió `docker compose up --build` (recreando el contenedor, igual que `start.ps1`), y la tarjeta seguía presente después del rebuild.

## Prioridad media

### 2. Guardado del tablero sin debounce: cada tecla al renombrar una columna dispara un PUT completo
- **Dónde:** `frontend/src/components/KanbanColumn.tsx:44-49` (`onChange` del input de título llama `onRename` en cada pulsación) → `frontend/src/components/KanbanBoard.tsx:88-95` (`handleRenameColumn` hace `setBoard` de inmediato) → `frontend/src/components/KanbanBoard.tsx:60-68` (efecto que llama `saveBoard(board)` en cada cambio de `board`, sin debounce).
- **Impacto:** escribir un título de 20 caracteres genera ~20 requests `PUT /api/board` secuenciales. Funciona porque cada request envía el estado completo, pero es tráfico y escritura a SQLite innecesarios, y en una red lenta las respuestas pueden llegar desordenadas.
- **Acción:** debounce del guardado (300–500 ms) en el efecto de `KanbanBoard.tsx`, o mantener el título en estado local del input y confirmar `onBlur`/`onRename` solo al perder foco.
- **✅ Resuelto:** se reemplazó el efecto genérico por `persistBoard` (guardado inmediato para drag/drop, agregar y borrar tarjetas) y `persistBoardDebounced` (500 ms, solo para rename de columna). Verificado con la suite unit y e2e completa, sin regresiones.

### 3. Guardado redundante inmediatamente después de cargar o recibir el tablero remoto
- **Dónde:** `frontend/src/components/KanbanBoard.tsx:43-58` (efecto de carga) y `:60-68` (efecto de guardado).
- **Problema:** en el callback de `getBoard().then(...)`, `hasLoadedRemoteBoard.current` se pone en `true` en el mismo tick en que se llama `setBoard(remoteBoard)`. Cuando React vuelve a renderizar por el cambio de `board`, el efecto de guardado ya ve el ref en `true` y ejecuta `saveBoard(board)` con los mismos datos que se acaban de leer. Lo mismo ocurre cuando `AIChatSidebar` aplica una actualización de tablero que el backend ya persistió (`onBoardUpdate={setBoard}` en `KanbanBoard.tsx:230`): se vuelve a hacer `PUT /api/board` con datos que el servidor ya guardó al procesar `/api/ai/chat`.
- **Impacto:** escrituras SQLite duplicadas sin efecto funcional visible hoy, pero es una señal de que "cargar/recibir" y "el usuario editó" no están distinguidos, lo que puede esconder condiciones de carrera reales más adelante (por ejemplo, si se agrega guardado optimista o multi-pestaña).
- **Acción:** solo disparar el guardado ante mutaciones locales explícitas (rename, add, delete, drag, drop), no como reacción genérica a cualquier cambio de `board`.
- **✅ Resuelto:** junto con el punto 2, `setBoard` en la carga inicial y en `onBoardUpdate` de `AIChatSidebar` ya no disparan ningún guardado; solo las mutaciones locales llaman a `persistBoard`/`persistBoardDebounced`.

### 4. `/api/auth/login` no valida el payload con Pydantic
- **Dónde:** `backend/app/main.py:38-44`.
- **Problema:** el resto de los endpoints usa modelos Pydantic con `model_config = ConfigDict(extra="forbid")` (ver `schemas.py`), pero `login(credentials: dict[str, str], ...)` acepta un `dict` crudo. `credentials.get("username", "")` sustituye silenciosamente un campo faltante por cadena vacía en lugar de devolver `422`, y no hay límite de tipo/tamaño ni documentación automática en OpenAPI para este endpoint.
- **Acción:** introducir `class LoginRequest(BaseModel)` en `schemas.py` (con `extra="forbid"`) y usarla como parámetro de la ruta, consistente con `BoardData` y `ChatRequest`.
- **✅ Resuelto:** agregado `LoginRequest` en `schemas.py` y la ruta `login` ahora lo usa como parámetro. Suite de backend (11 tests) en verde.

### 5. `Database.initialize()` se ejecuta a nivel de módulo contra la ruta de base de datos real
- **Dónde:** `backend/app/main.py:18-19` (`database = Database(); database.initialize()`, evaluado al importar `app.main`).
- **Problema:** `PM_DATABASE_PATH` no está seteado durante los tests, así que **el simple hecho de importar `app.main`** (antes de que el fixture `temporary_database` en `tests/test_main.py:9-12` reasigne `database.path`) crea/inicializa `backend/data/project-management.db`, la base "real" de desarrollo. Confirmado: ese archivo existe en el repo local. `backend/data/` está en `.gitignore`, así que no se filtra a git, pero rompe el aislamiento de tests y siembra datos de seed en la base de desarrollo sin que el desarrollador lo pida.
- **Acción:** mover la inicialización a un evento `startup`/`lifespan` de FastAPI, o inicializar de forma perezosa en el primer acceso, en vez de como side-effect de import.
- **✅ Resuelto:** `database.initialize()` ahora se ejecuta dentro de un `lifespan` de FastAPI (`@asynccontextmanager`), no al importar el módulo. Los tests siguen aislados porque el fixture `temporary_database` sigue reasignando `database.path` explícitamente.

### 6. Sesiones expiradas nunca se limpian
- **Dónde:** `backend/app/database.py:107-115` (`create_session`), tabla `sessions`.
- **Problema:** las filas de `sessions` solo se borran en `logout` (`delete_session`); las que expiran por tiempo (`expires_at`, 1 día) quedan para siempre en la tabla.
- **Impacto:** bajo para un MVP de un solo usuario, pero es crecimiento no acotado.
- **Acción:** borrar sesiones expiradas al crear una nueva (`DELETE FROM sessions WHERE expires_at <= ?`) o agregar una tarea periódica simple.
- **✅ Resuelto:** `create_session` ahora borra las sesiones con `expires_at <= now` antes de insertar la nueva.

## Prioridad baja / mejoras menores

### 7. Duplicación entre `ask_openrouter` y `ask_openrouter_structured`
- **Dónde:** `backend/app/ai.py:19-44` y `:47-103`.
- **Problema:** ambas funciones repiten la lectura de `OPENROUTER_API_KEY`, la construcción de headers y el manejo de excepciones `httpx`.
- **Acción:** extraer un helper interno (p. ej. `_post_chat_completion(payload) -> dict`) que ambas reutilicen.

### 8. No hay `.dockerignore`
- **Dónde:** raíz del repo.
- **Problema:** no hay un `.dockerignore` explícito; el build actual es pequeño (4.82 MB de contexto) porque BuildKit solo transfiere lo referenciado por `COPY`, pero esto es un comportamiento de BuildKit, no una garantía del `Dockerfile`. Con Docker clásico (sin BuildKit) el contexto incluiría `frontend/node_modules`, `.venv`, `frontend/out`, `test-results`, etc.
- **Acción:** agregar `.dockerignore` con `**/node_modules`, `**/.venv`, `frontend/out`, `frontend/test-results`, `**/__pycache__`, `.git`.

### 9. Documentación desactualizada en `frontend/AGENTS.md` y `frontend/README.md`
- **Dónde:** `frontend/AGENTS.md:24` dice "Language switching is not implemented yet", pero `src/lib/i18n.tsx` y el selector ES/EN en `KanbanBoard.tsx:186-196` ya están implementados. `frontend/README.md` describe un "Kanban Studio" genérico sin mencionar auth, backend ni AI chat, y usa solo `npm run test:unit`/`test:e2e` sin `test:all`.
- **Acción:** actualizar ambos archivos para reflejar el estado actual (login, persistencia, AI chat, i18n) y evitar que un colaborador nuevo confíe en información obsoleta.

### 10. Cobertura de tests por componente pequeño
- **Dónde:** `frontend/src/components/`.
- **Problema:** `KanbanColumn`, `KanbanCard`, `NewCardForm` y `KanbanCardPreview` no tienen tests unitarios propios; su comportamiento (rename, add, delete) solo se cubre indirectamente a través de `KanbanBoard.test.tsx`.
- **Acción:** opcional para el tamaño actual del proyecto; si el equipo crece o estos componentes ganan lógica, vale la pena aislarlos.

## Resumen de acciones (por prioridad)

| # | Acción | Prioridad | Estado |
|---|--------|-----------|--------|
| 1 | Montar volumen Docker para `backend/data` y persistir la SQLite entre reinicios | Alta | ✅ Resuelto |
| 2 | Debounce del autosave del tablero (especialmente rename de columna) | Media | ✅ Resuelto |
| 3 | Evitar guardar el tablero recién cargado/recibido de la IA como si fuera una edición del usuario | Media | ✅ Resuelto |
| 4 | Validar `/api/auth/login` con un modelo Pydantic (`LoginRequest`) | Media | ✅ Resuelto |
| 5 | Mover `Database.initialize()` fuera del import de `app.main` (usar `lifespan`) | Media | ✅ Resuelto |
| 6 | Limpiar sesiones expiradas en `sessions` | Media | ✅ Resuelto |
| 7 | Extraer helper común para las llamadas a OpenRouter en `ai.py` | Baja | Pendiente |
| 8 | Agregar `.dockerignore` explícito | Baja | Pendiente |
| 9 | Actualizar `frontend/AGENTS.md` y `frontend/README.md` | Baja | Pendiente |
| 10 | Tests unitarios dedicados para componentes Kanban individuales | Baja | Pendiente |

## Lo que ya está bien (no requiere acción)

- Validación de integridad del tablero en `schemas.py` (IDs únicos, referencia cruzada columnas/tarjetas, `extra="forbid"`) aplicada tanto a ediciones manuales como a actualizaciones generadas por la IA antes de persistir.
- La propiedad del tablero siempre se resuelve desde la sesión autenticada (`int(user["id"])`), nunca desde un ID enviado por el cliente.
- Contraseñas con PBKDF2-HMAC-SHA256 (120,000 iteraciones) + comparación de tiempo constante (`hmac.compare_digest`).
- `.env` correctamente excluido de git (`.gitignore`) y nunca commiteado (verificado contra el historial completo).
- Suite de tests real y útil: 11 tests de backend, 13 de frontend, 4 e2e mockeados y 2 e2e contra el contenedor real, todos verdes al momento de esta revisión.
