import { createRoot } from "react-dom/client";
const elem = document.getElementById("root")!;
import { Providers } from "./Providers";
import { App } from "./App";

const app = (
  <Providers>
    <App />
  </Providers>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
