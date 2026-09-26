import type { Metadata } from "next";
import { SolarLab } from "@/components/sim/lab";

export const metadata: Metadata = {
  title: { absolute: "Quark Lab · Simulador de energia solar" },
  description: "Simulador de sistemas fotovoltaicos com baterias, cargas flexíveis, zero grid, cortes de geração distribuída e apagões — para estudo e pesquisa.",
};

export default function SimuladorPage() {
  return <SolarLab />;
}
