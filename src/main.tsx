import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { createGameStore, startGame } from "./runtime/store";
import "./ui/styles.css";

// Accessing localStorage itself can throw in privacy-restricted browsers.
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
const store = createGameStore(storage);
const stop = startGame(store);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App store={store} /></React.StrictMode>,
);
if (import.meta.hot) import.meta.hot.dispose(stop);
