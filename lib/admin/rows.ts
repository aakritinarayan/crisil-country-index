import "server-only";
import type { Admin } from "@/lib/auth";
import { actionsFor, capabilitiesFor } from "./permissions";
import { fmtDateTime, fmtPeriod } from "./format";
import type { Source } from "./store";
import type { VersionRecord } from "./types";
import type { Row } from "@/components/admin/VersionTable";
import type { ActionContext } from "./permissions";

/** Table rows for versions: actions decided on the server, dates formatted in the admin
 *  time zone (ADMIN_TIME_ZONE is a server setting the browser doesn't have). */
export function tableRows(versions: VersionRecord[], admin: Admin, source: Source, ctx: ActionContext): Row[] {
  const caps = capabilitiesFor(admin);
  return versions.map((v) => ({ v, actions: actionsFor(v, caps, source, ctx), uploadedOn: fmtDateTime(v.created_at), period: fmtPeriod(v.as_of) }));
}
