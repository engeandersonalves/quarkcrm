import { MonitoringError, type ProviderAdapter } from "../types.ts";

/** Usinas de outros fabricantes: cadastradas à mão e alimentadas por planilha. */
export const manual: ProviderAdapter = {
  id: "manual",
  fetchPlants: async () => {
    throw new MonitoringError("Usinas manuais não sincronizam: importe a planilha de geração.");
  },
};
