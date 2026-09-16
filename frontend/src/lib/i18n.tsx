"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type Language = "en" | "es";

const translations = {
  en: {
    singleBoard: "Single Board Kanban",
    title: "Kanban Studio",
    loginPrompt: "Sign in to keep your project momentum visible.",
    username: "Username",
    password: "Password",
    signIn: "Sign in",
    invalidCredentials: "Invalid username or password.",
    tryDemo: "Try the demo",
    demoNote: "The demo session lasts 1 hour. Its board and data are deleted afterwards.",
    demoError: "Unable to start the demo.",
    or: "or",
    logout: "Log out",
    focus: "Focus",
    focusValue: "One board. Five columns. Zero clutter.",
    boardDescription: "Keep momentum visible. Rename columns, drag cards between stages, and capture quick notes without getting buried in settings.",
    cards: "cards",
    dropCard: "Drop a card here",
    addCard: "Add a card",
    cardTitle: "Card title",
    details: "Details",
    cancel: "Cancel",
    remove: "Remove",
    editTitle: "Edit card title",
    editDetails: "Edit card details",
    doubleClickToEdit: "Double-click to edit",
    assistant: "Assistant",
    copilot: "Board copilot",
    available: "AI assistant available",
    askPrompt: "Ask about the board or request a card change.",
    askAssistant: "Ask the assistant",
    send: "Send",
    sending: "Sending",
    aiError: "Unable to reach the AI assistant.",
    aiLimitReached: "You have reached the AI message limit for this session.",
    boardLoadError: "Unable to load the board.",
    boardSaveError: "Unable to save the latest board change.",
  },
  es: {
    singleBoard: "Kanban de un solo tablero",
    title: "Estudio Kanban",
    loginPrompt: "Inicia sesión para mantener visible el avance de tu proyecto.",
    username: "Usuario",
    password: "Contraseña",
    signIn: "Iniciar sesión",
    invalidCredentials: "El usuario o la contraseña no son válidos.",
    tryDemo: "Probar la demo",
    demoNote: "La sesión de demo dura 1 hora. Después se eliminan su tablero y sus datos.",
    demoError: "No se pudo iniciar la demo.",
    or: "o",
    logout: "Cerrar sesión",
    focus: "Enfoque",
    focusValue: "Un tablero. Cinco columnas. Cero desorden.",
    boardDescription: "Mantén visible el avance. Renombra columnas, arrastra tarjetas entre etapas y añade notas rápidas sin perderte en la configuración.",
    cards: "tarjetas",
    dropCard: "Suelta una tarjeta aquí",
    addCard: "Añadir tarjeta",
    cardTitle: "Título de la tarjeta",
    details: "Detalles",
    cancel: "Cancelar",
    remove: "Eliminar",
    editTitle: "Editar título de la tarjeta",
    editDetails: "Editar detalles de la tarjeta",
    doubleClickToEdit: "Haz doble clic para editar",
    assistant: "Asistente",
    copilot: "Copiloto del tablero",
    available: "Asistente de IA disponible",
    askPrompt: "Pregunta sobre el tablero o solicita un cambio.",
    askAssistant: "Pregunta al asistente",
    send: "Enviar",
    sending: "Enviando",
    aiError: "No se pudo contactar al asistente de IA.",
    aiLimitReached: "Alcanzaste el límite de mensajes de IA para esta sesión.",
    boardLoadError: "No se pudo cargar el tablero.",
    boardSaveError: "No se pudo guardar el último cambio.",
  },
} as const;

type TranslationKey = keyof typeof translations.en;
type I18nContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const I18nContext = createContext<I18nContextValue | null>(null);
const defaultI18n: I18nContextValue = {
  language: "en",
  setLanguage: () => undefined,
  t: (key) => translations.en[key],
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("en");
  const t = useCallback((key: TranslationKey) => translations[language][key], [language]);
  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  return context || defaultI18n;
};