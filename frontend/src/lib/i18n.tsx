"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type Language = "en" | "es";

export const translations = {
  en: {
    title: "Kanban Studio",
    "entry.eyebrow": "Single board kanban",
    "entry.lead1":
      "One board, five columns, zero clutter. Drag cards between stages, rename columns, and keep quick notes without getting buried in settings.",
    "entry.lead2":
      "The difference is the copilot: tell it what you want in plain language and it rewrites the board for you.",
    "entry.sample.prompt": "Move everything about security into In Progress",
    "entry.sample.card1": "Rotate the API keys",
    "entry.sample.card2": "Review the login audit",
    "entry.try.heading": "Three things to try",
    "entry.try1": "Drag a card from Backlog to Discovery, or double-click it to edit the title and the notes.",
    "entry.try2": "Ask the copilot to summarise the board, or to draft the cards for a release checklist.",
    "entry.try3": "Everything you change is saved, so a reload brings your board back.",
    "entry.stack": "Next.js and FastAPI, SQLite and Turso, OpenRouter for the copilot.",
    "entry.source": "Read the source",
    "entry.card.title": "Start in one tap",
    "entry.demo.button": "Try the demo",
    "entry.demo.note":
      "No account, no email. Your demo session lasts one hour, then the board and its data are deleted.",
    "entry.demo.loading": "Starting the demo",
    "entry.demo.error": "Unable to start the demo.",
    "entry.or": "Or",
    "entry.signin": "Sign in",
    "entry.signin.loading": "Signing in",
    "entry.username": "Username",
    "entry.password": "Password",
    "entry.invalid": "Invalid username or password.",
    "entry.language": "Language",
    "welcome.eyebrow": "You are in",
    "welcome.heading": "This board is yours for the next hour.",
    "welcome.lead": "Nothing you do here touches anyone else. Three things worth trying before it expires.",
    "welcome.item1.title": "Move a card",
    "welcome.item1.body":
      "Drag it between Backlog, Discovery, In Progress, Review and Done. Double-click a card to edit it.",
    "welcome.item2.title": "Tell the copilot what you want",
    "welcome.item2.body": "It is the panel on the right. Cards it changes are marked in purple for a few seconds.",
    "welcome.item3.title": "Reload the page",
    "welcome.item3.body": "Your board comes back exactly as you left it. After an hour it is deleted.",
    "welcome.start": "Start using the board",
    "welcome.close": "Close",
    "board.focus": "Focus",
    "board.focus.value": "One board. Five columns. Zero clutter.",
    "board.description":
      "Keep momentum visible. Rename columns, drag cards between stages, and capture quick notes without getting buried in settings.",
    "board.session": "Demo session · {minutes} min left",
    "board.logout": "Log out",
    "board.logout.loading": "Signing out",
    "board.loading": "Loading your board",
    "board.cards.zero": "No cards",
    "board.cards.one": "1 card",
    "board.cards.other": "{count} cards",
    "board.drop": "Drop a card here",
    "board.add": "Add a card",
    "board.column.title": "Column title",
    "board.load.error": "Unable to load the board.",
    "board.save.error": "Unable to save the latest board change.",
    "card.title": "Card title",
    "card.details": "Details",
    "card.cancel": "Cancel",
    "card.remove": "Remove",
    "card.edit.title": "Edit card title",
    "card.edit.details": "Edit card details",
    "card.edit.hint": "Double-click to edit",
    "card.copilot.chip": "Moved by the copilot",
    "copilot.title": "Board copilot",
    "copilot.counter": "{used} of {limit}",
    "copilot.label": "Ask about the board or request a card change",
    "copilot.placeholder": "Draft the cards for a release checklist",
    "copilot.send": "Send",
    "copilot.sending": "Sending",
    "copilot.updated.one": "1 card updated on the board",
    "copilot.updated": "{count} cards updated on the board",
    "copilot.error": "Unable to reach the AI assistant.",
    "copilot.limit.session": "You have reached the AI message limit for this session.",
    "copilot.limit.daily": "The AI assistant has reached its daily limit. Try again tomorrow.",
    "footer.builtby": "Built by {name}",
    "footer.builtby.body": "Designed, built and deployed end to end, from the database to the copilot.",
    "footer.linkedin": "LinkedIn",
    "footer.github": "GitHub",
    "footer.frontend": "Frontend",
    "footer.frontend.1": "Next.js, exported as static files and served from the CDN.",
    "footer.frontend.2": "Drag and drop, inline editing, English and Spanish.",
    "footer.backend": "Backend",
    "footer.backend.1": "FastAPI running as a Python function on Vercel.",
    "footer.backend.2": "Session auth, one board per user, {tests} automated tests.",
    "footer.data": "Data and copilot",
    "footer.data.1": "Turso, SQLite compatible, one JSON board per user.",
    "footer.data.2": "openai/gpt-oss-120b through OpenRouter, capped per session.",
    "footer.note": "Public demo. Guest boards are deleted one hour after they are created.",
    "footer.perf": "{load} to load a board · {cold} cold start · {limit} copilot messages per session",
  },
  es: {
    title: "Kanban Studio",
    "entry.eyebrow": "Kanban de un solo tablero",
    "entry.lead1":
      "Un tablero, cinco columnas, cero ruido. Arrastrá tarjetas entre etapas, renombrá columnas y anotá lo justo sin perderte en configuraciones.",
    "entry.lead2":
      "La diferencia es el copiloto: decile en lenguaje natural lo que querés y reescribe el tablero por vos.",
    "entry.sample.prompt": "Pasá todo lo de seguridad a In Progress",
    "entry.sample.card1": "Rotar las claves de la API",
    "entry.sample.card2": "Revisar la auditoría de login",
    "entry.try.heading": "Tres cosas para probar",
    "entry.try1": "Arrastrá una tarjeta de Backlog a Discovery, o hacé doble clic para editar el título y las notas.",
    "entry.try2": "Pedile al copiloto que resuma el tablero, o que arme las tarjetas de un checklist de release.",
    "entry.try3": "Todo lo que cambiás se guarda, así que al recargar tu tablero vuelve.",
    "entry.stack": "Next.js y FastAPI, SQLite y Turso, OpenRouter para el copiloto.",
    "entry.source": "Ver el código",
    "entry.card.title": "Entrá en un toque",
    "entry.demo.button": "Probar la demo",
    "entry.demo.note":
      "Sin cuenta ni correo. Tu sesión de demo dura una hora, después se borran el tablero y sus datos.",
    "entry.demo.loading": "Iniciando la demo",
    "entry.demo.error": "No se pudo iniciar la demo.",
    "entry.or": "O",
    "entry.signin": "Iniciar sesión",
    "entry.signin.loading": "Iniciando sesión",
    "entry.username": "Usuario",
    "entry.password": "Contraseña",
    "entry.invalid": "El usuario o la contraseña no son válidos.",
    "entry.language": "Idioma",
    "welcome.eyebrow": "Ya estás adentro",
    "welcome.heading": "Este tablero es tuyo por la próxima hora.",
    "welcome.lead": "Nada de lo que hagas acá toca a nadie más. Tres cosas que vale la pena probar antes de que expire.",
    "welcome.item1.title": "Mové una tarjeta",
    "welcome.item1.body":
      "Arrastrala entre Backlog, Discovery, In Progress, Review y Done. Hacé doble clic para editarla.",
    "welcome.item2.title": "Decile al copiloto qué querés",
    "welcome.item2.body": "Es el panel de la derecha. Las tarjetas que cambia quedan marcadas en violeta unos segundos.",
    "welcome.item3.title": "Recargá la página",
    "welcome.item3.body": "Tu tablero vuelve tal como lo dejaste. Después de una hora se borra.",
    "welcome.start": "Empezar a usar el tablero",
    "welcome.close": "Cerrar",
    "board.focus": "Enfoque",
    "board.focus.value": "Un tablero. Cinco columnas. Cero ruido.",
    "board.description":
      "Mantené visible el avance. Renombrá columnas, arrastrá tarjetas entre etapas y anotá lo justo sin perderte en configuraciones.",
    "board.session": "Sesión de demo · quedan {minutes} min",
    "board.logout": "Salir",
    "board.logout.loading": "Saliendo",
    "board.loading": "Cargando tu tablero",
    "board.cards.zero": "Sin tarjetas",
    "board.cards.one": "1 tarjeta",
    "board.cards.other": "{count} tarjetas",
    "board.drop": "Soltá una tarjeta acá",
    "board.add": "Agregar tarjeta",
    "board.column.title": "Título de la columna",
    "board.load.error": "No se pudo cargar el tablero.",
    "board.save.error": "No se pudo guardar el último cambio.",
    "card.title": "Título de la tarjeta",
    "card.details": "Detalles",
    "card.cancel": "Cancelar",
    "card.remove": "Eliminar",
    "card.edit.title": "Editar título de la tarjeta",
    "card.edit.details": "Editar detalles de la tarjeta",
    "card.edit.hint": "Hacé doble clic para editar",
    "card.copilot.chip": "Movida por el copiloto",
    "copilot.title": "Copiloto del tablero",
    "copilot.counter": "{used} de {limit}",
    "copilot.label": "Preguntá sobre el tablero o pedí un cambio",
    "copilot.placeholder": "Armá las tarjetas de un checklist de release",
    "copilot.send": "Enviar",
    "copilot.sending": "Enviando",
    "copilot.updated.one": "1 tarjeta actualizada en el tablero",
    "copilot.updated": "{count} tarjetas actualizadas en el tablero",
    "copilot.error": "No se pudo contactar al asistente de IA.",
    "copilot.limit.session": "Alcanzaste el límite de mensajes de IA para esta sesión.",
    "copilot.limit.daily": "El asistente de IA alcanzó su límite diario. Volvé a intentarlo mañana.",
    "footer.builtby": "Hecho por {name}",
    "footer.builtby.body": "Diseñado, construido y desplegado de punta a punta, desde la base de datos hasta el copiloto.",
    "footer.linkedin": "LinkedIn",
    "footer.github": "GitHub",
    "footer.frontend": "Frontend",
    "footer.frontend.1": "Next.js, exportado como archivos estáticos y servido desde la CDN.",
    "footer.frontend.2": "Arrastrar y soltar, edición en línea, inglés y español.",
    "footer.backend": "Backend",
    "footer.backend.1": "FastAPI corriendo como función Python en Vercel.",
    "footer.backend.2": "Sesión por cookie, un tablero por usuario, {tests} tests automatizados.",
    "footer.data": "Datos y copiloto",
    "footer.data.1": "Turso, compatible con SQLite, un tablero JSON por usuario.",
    "footer.data.2": "openai/gpt-oss-120b vía OpenRouter, con tope por sesión.",
    "footer.note": "Demo pública. Los tableros de invitado se borran una hora después de creados.",
    "footer.perf":
      "{load} para cargar un tablero · {cold} de arranque en frío · {limit} mensajes de copiloto por sesión",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
type Params = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: Params) => string;

const interpolate = (template: string, params?: Params) =>
  params ? template.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match)) : template;

export const translate = (language: Language, key: TranslationKey, params?: Params) =>
  interpolate(translations[language][key], params);

type I18nContextValue = { language: Language; setLanguage: (language: Language) => void; t: Translate };
const I18nContext = createContext<I18nContextValue | null>(null);
const defaultI18n: I18nContextValue = {
  language: "en",
  setLanguage: () => undefined,
  t: (key, params) => translate("en", key, params),
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("en");
  const t = useCallback<Translate>((key, params) => translate(language, key, params), [language]);
  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  return context || defaultI18n;
};

// Card counts for the header pills and the column heads: "No cards", "1 card", "3 cards".
export const cardCountLabel = (t: Translate, count: number) => {
  if (count === 0) {
    return t("board.cards.zero");
  }
  return count === 1 ? t("board.cards.one") : t("board.cards.other", { count });
};
