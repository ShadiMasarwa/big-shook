import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setSessionIdGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("token"));

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem("sessionId");
  if (existing && existing !== "default-session") return existing;
  const id = crypto.randomUUID();
  localStorage.setItem("sessionId", id);
  return id;
}

getOrCreateSessionId();
setSessionIdGetter(() => localStorage.getItem("sessionId"));

createRoot(document.getElementById("root")!).render(<App />);
