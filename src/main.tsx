import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@pheralb/toast";
import "@/styles/globals.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster
      toastOptions={{
        defaultCloseContent: "Cerrar",
      }}
    />
  </StrictMode>
);
