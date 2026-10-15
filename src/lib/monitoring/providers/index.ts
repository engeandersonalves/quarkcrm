import type { ProviderAdapter, ProviderId } from "../types.ts";
import { deye, solarman } from "./deye.ts";
import { growatt } from "./growatt.ts";
import { huawei } from "./huawei.ts";
import { solis } from "./solis.ts";
import { solplanet } from "./solplanet.ts";
import { sungrow } from "./sungrow.ts";

export const ADAPTERS: Record<ProviderId, ProviderAdapter> = { solis, deye, solarman, sungrow, growatt, huawei, solplanet };
