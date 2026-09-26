import { createRoot } from "react-dom/client";
import { SolarLab } from "@/components/sim/lab";

createRoot(document.getElementById("quark-lab")!).render(<SolarLab />);
