export type OrganizationStatus = "Active" | "Trial" | "Suspended";
export type UserStatus = "Active" | "Invited" | "Suspended";

export interface Organization {
  id: number | string;
  name: string;
  initials: string;
  plan: "Starter" | "Professional" | "Enterprise";
  owner: string;
  users: number;
  projects: number;
  submissions: string;
  status: OrganizationStatus;
  activity: string;
}

export interface PlatformUser {
  id: number | string;
  name: string;
  initials: string;
  email: string;
  organization: string;
  role: "Super Admin" | "Organization Admin" | "Data Manager" | "Analyst";
  status: UserStatus;
  lastActive: string;
}

export interface Invoice {
  id: string;
  organization: string;
  plan: string;
  amount: string;
  issued: string;
  status: "Paid" | "Pending" | "Overdue";
}

export interface AuditEvent {
  id: number | string;
  actor: string;
  initials: string;
  action: string;
  target: string;
  category: "Access" | "Organization" | "Billing" | "Security";
  ip: string;
  time: string;
  status: "Completed" | "Blocked";
}

export interface SystemService {
  name: string;
  description: string;
  uptime: string;
  latency: string;
  status: "Healthy" | "Degraded";
}

export const organizations: Organization[] = [
  {
    id: 1,
    name: "Community Health Initiative",
    initials: "CH",
    plan: "Enterprise",
    owner: "Amara Johnson",
    users: 84,
    projects: 7,
    submissions: "10,284",
    status: "Active",
    activity: "8 min ago",
  },
  {
    id: 2,
    name: "Liberia WASH Network",
    initials: "LW",
    plan: "Professional",
    owner: "Daniel Kollie",
    users: 42,
    projects: 5,
    submissions: "8,912",
    status: "Active",
    activity: "24 min ago",
  },
  {
    id: 3,
    name: "Youth Futures Africa",
    initials: "YF",
    plan: "Professional",
    owner: "Martha Doe",
    users: 31,
    projects: 3,
    submissions: "4,716",
    status: "Trial",
    activity: "2 hours ago",
  },
  {
    id: 4,
    name: "County Education Office",
    initials: "CE",
    plan: "Starter",
    owner: "Joseph Teah",
    users: 18,
    projects: 2,
    submissions: "2,408",
    status: "Suspended",
    activity: "4 days ago",
  },
  {
    id: 5,
    name: "Rural Development Alliance",
    initials: "RD",
    plan: "Enterprise",
    owner: "Grace Freeman",
    users: 67,
    projects: 6,
    submissions: "12,640",
    status: "Active",
    activity: "Yesterday",
  },
];

export const platformUsers: PlatformUser[] = [
  { id: 1, name: "Gabriel Akoi", initials: "GA", email: "gabriel@fieldsight.io", organization: "FieldSight", role: "Super Admin", status: "Active", lastActive: "Now" },
  { id: 2, name: "Amara Johnson", initials: "AJ", email: "amara@communityhealth.org", organization: "Community Health Initiative", role: "Organization Admin", status: "Active", lastActive: "8 min ago" },
  { id: 3, name: "Daniel Kollie", initials: "DK", email: "daniel@washnetwork.org", organization: "Liberia WASH Network", role: "Organization Admin", status: "Active", lastActive: "24 min ago" },
  { id: 4, name: "Martha Doe", initials: "MD", email: "martha@youthfutures.org", organization: "Youth Futures Africa", role: "Data Manager", status: "Active", lastActive: "2 hours ago" },
  { id: 5, name: "Joseph Teah", initials: "JT", email: "joseph@education.gov.lr", organization: "County Education Office", role: "Organization Admin", status: "Suspended", lastActive: "4 days ago" },
  { id: 6, name: "Grace Freeman", initials: "GF", email: "grace@rda.org", organization: "Rural Development Alliance", role: "Analyst", status: "Invited", lastActive: "Never" },
];

export const invoices: Invoice[] = [
  { id: "INV-2084", organization: "Community Health Initiative", plan: "Enterprise", amount: "$3,600", issued: "Aug 18, 2026", status: "Paid" },
  { id: "INV-2083", organization: "Rural Development Alliance", plan: "Enterprise", amount: "$3,600", issued: "Aug 18, 2026", status: "Paid" },
  { id: "INV-2082", organization: "Liberia WASH Network", plan: "Professional", amount: "$1,200", issued: "Aug 15, 2026", status: "Pending" },
  { id: "INV-2081", organization: "Youth Futures Africa", plan: "Professional", amount: "$1,200", issued: "Aug 12, 2026", status: "Paid" },
  { id: "INV-2080", organization: "County Education Office", plan: "Starter", amount: "$360", issued: "Aug 8, 2026", status: "Overdue" },
];

export const auditEvents: AuditEvent[] = [
  { id: 1, actor: "Gabriel Akoi", initials: "GA", action: "Updated authentication policy", target: "Platform security", category: "Security", ip: "102.176.94.18", time: "Today, 10:42", status: "Completed" },
  { id: 2, actor: "Amara Johnson", initials: "AJ", action: "Created organization project", target: "Community Health Initiative", category: "Organization", ip: "197.157.18.42", time: "Today, 10:18", status: "Completed" },
  { id: 3, actor: "System", initials: "SY", action: "Blocked repeated sign-in attempts", target: "joseph@education.gov.lr", category: "Access", ip: "45.86.201.11", time: "Today, 09:54", status: "Blocked" },
  { id: 4, actor: "Gabriel Akoi", initials: "GA", action: "Changed subscription plan", target: "Rural Development Alliance", category: "Billing", ip: "102.176.94.18", time: "Yesterday, 16:20", status: "Completed" },
  { id: 5, actor: "Daniel Kollie", initials: "DK", action: "Invited organization administrator", target: "Liberia WASH Network", category: "Access", ip: "197.157.21.86", time: "Yesterday, 14:11", status: "Completed" },
  { id: 6, actor: "System", initials: "SY", action: "Rotated API signing keys", target: "Production environment", category: "Security", ip: "Internal", time: "Aug 21, 02:00", status: "Completed" },
];

export const systemServices: SystemService[] = [
  { name: "Public API", description: "REST and authentication endpoints", uptime: "99.99%", latency: "184 ms", status: "Healthy" },
  { name: "Kobo sync workers", description: "Imports and scheduled synchronization", uptime: "99.97%", latency: "12 active jobs", status: "Healthy" },
  { name: "Primary database", description: "Managed PostgreSQL cluster", uptime: "99.98%", latency: "34% storage", status: "Healthy" },
  { name: "Background queue", description: "Exports, reports, and notifications", uptime: "99.91%", latency: "48 queued", status: "Healthy" },
  { name: "Email delivery", description: "Invitations and platform notifications", uptime: "98.74%", latency: "2.8 sec", status: "Degraded" },
];

export const adoptionGrowth = [42, 55, 49, 64, 71, 68, 82, 76, 91, 86, 96, 100];
export const adoptionMonths = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
