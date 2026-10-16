import type { ProviderAdapter, ProviderId } from "../types.ts";
import { apsystems } from "./apsystems.ts";
import { deye, solarman } from "./deye.ts";
import { foxess } from "./foxess.ts";
import { goodwe } from "./goodwe.ts";
import { growatt } from "./growatt.ts";
import { huawei } from "./huawei.ts";
import { livoltek } from "./livoltek.ts";
import { manual } from "./manual.ts";
import { solarz } from "./solarz.ts";
import { solis } from "./solis.ts";
import { solplanet } from "./solplanet.ts";
import { sungrow } from "./sungrow.ts";

export const ADAPTERS: Record<ProviderId, ProviderAdapter> = { solarz, solis, deye, solarman, sungrow, growatt, huawei, solplanet, goodwe, livoltek, foxess, apsystems, manual };
