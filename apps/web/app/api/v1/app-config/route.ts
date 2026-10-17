import { createAppConfigHandler } from "@krizaka/app-config/server";

import { appConfigStore } from "@/lib/app-config";

export const dynamic = "force-dynamic";

/**
 * `GET /api/v1/app-config?platform=ios|android&version=x.y.z` (krizaka/.github#75): public, short-cached. What an app
 * must do about the version it runs — nothing, a soft prompt, a forced update, maintenance — from the `app_config` table.
 */
export const GET = createAppConfigHandler({ store: appConfigStore });
