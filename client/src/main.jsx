import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AppProviders from "./app/providers.jsx";

createRoot(document.getElementById("root")).render(
  <AppProviders>
    <App />
  </AppProviders>
);