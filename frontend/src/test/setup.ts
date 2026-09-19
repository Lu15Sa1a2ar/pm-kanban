import "@testing-library/jest-dom";

// The app defaults to Spanish; the unit tests are written against the English copy.
window.localStorage.setItem("pm-language", "en");
