import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { AdminPanel } from "../../components/superadmin/AdminUi";
export function BillingPage() { return <><PageHeader eyebrow="Platform configuration" title="Billing & plans" description="Configuration requires operational backend support." /><AdminPanel title="Not configured"><p className="py-4 text-sm leading-7 text-[var(--fs-muted)]">No authoritative subscription, invoice, payment, or revenue infrastructure is configured. Financial reporting and plan changes require a billing integration.</p><Link className="inline-flex min-h-11 items-center font-semibold text-brand" to="/superadmin/sectors">Manage sector catalog</Link></AdminPanel></>; }
