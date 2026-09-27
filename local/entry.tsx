import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { Studio } from "../src/components/solar3d/studio";

createRoot(document.getElementById("root")!).render(
  <>
    <main className="mx-auto w-full max-w-[1500px] p-3 sm:p-5">
      <Studio standalone />
    </main>
    <Toaster position="top-center" richColors closeButton />
  </>,
);
