import {
  Building2,
  CircleDollarSign,
  CreditCard,
  Download,
  MoreHorizontal,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { Button, PageHeader } from "../../components/ui";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminMetric, AdminPanel, AdminStatus, AdminTableFooter } from "../../components/superadmin/AdminUi";
import { invoices } from "./data";

const revenueTrend = [
  { month: "Mar", revenue: 31, target: 29 },
  { month: "Apr", revenue: 34, target: 31 },
  { month: "May", revenue: 36, target: 34 },
  { month: "Jun", revenue: 38, target: 36 },
  { month: "Jul", revenue: 40, target: 38 },
  { month: "Aug", revenue: 43, target: 40 },
];

const planDistribution = [
  { name: "Enterprise", organizations: 6, revenue: "$21,600", share: 50, color: "bg-brand" },
  { name: "Professional", organizations: 11, revenue: "$13,200", share: 31, color: "bg-[#6d5bd0]" },
  { name: "Starter", organizations: 7, revenue: "$2,520", share: 19, color: "bg-[#14a695]" },
];

export function BillingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Commercial operations"
        title="Billing & plans"
        description="Monitor subscriptions, recurring revenue, invoices, and plan distribution."
      >
        <Button variant="secondary">
          <Download size={15} /> Export report
        </Button>
        <Button>
          <CreditCard size={15} /> Configure plans
        </Button>
      </PageHeader>

      <section className="grid grid-cols-4 gap-[18px] max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
        <AdminMetric
          label="Monthly recurring revenue"
          value="$42,780"
          detail="Up 8.2% from last month"
          icon={CircleDollarSign}
          tone="green"
        />
        <AdminMetric
          label="Annual run rate"
          value="$513,360"
          detail="Based on active subscriptions"
          icon={TrendingUp}
        />
        <AdminMetric
          label="Paid organizations"
          value="21"
          detail="Of 24 platform tenants"
          icon={Building2}
          tone="violet"
        />
        <AdminMetric
          label="Outstanding"
          value="$1,560"
          detail="1 overdue, 1 pending"
          icon={ReceiptText}
          tone="orange"
        />
      </section>

      <section className="mt-[18px] grid grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)] gap-[18px] max-[1000px]:grid-cols-1">
        <AdminPanel title="Revenue trend" description="Recurring revenue collected over six months">
          <div className="flex h-[24px] justify-end gap-[14px] pt-[5px] text-[10px] text-[#788591]">
            <span className="flex items-center gap-[5px]"><i className="size-[7px] rounded-full bg-[#0b51b7]" /> Collected revenue</span>
            <span className="flex items-center gap-[5px]"><i className="size-[7px] rounded-full bg-[#6d81f5]" /> Revenue target</span>
          </div>
          <div className="h-[235px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b51b7" stopOpacity=".22" /><stop offset="1" stopColor="#0b51b7" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#edf0f2" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#7d8996", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9aa4ae", fontSize: 10 }} tickFormatter={(value) => `${value}k`} />
                <Tooltip formatter={(value: number) => [`${value}k`, ""]} contentStyle={{ border: "1px solid #e5e8ec", borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Collected revenue" stroke="#0b51b7" strokeWidth={2.4} fill="url(#revenueFill)" />
                <Area type="monotone" dataKey="target" name="Revenue target" stroke="#6d81f5" strokeWidth={2} fill="transparent" strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>

        <AdminPanel title="Plan distribution" description="Current organization subscriptions">
          <div className="p-5">
            {planDistribution.map((plan) => (
              <div className="mb-5 last:mb-0" key={plan.name}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <strong className="block text-[12px] text-[#324158]">{plan.name}</strong>
                    <small className="text-[10px] text-[#8793a2]">{plan.organizations} organizations</small>
                  </div>
                  <strong className="text-[12px] text-[#324158]">{plan.revenue}</strong>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f6]">
                  <div className={`h-full rounded-full ${plan.color}`} style={{ width: `${plan.share}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-5 rounded-[8px] bg-[#f5f8fc] p-3 text-[10px] leading-[1.6] text-[#657182]">
              Enterprise accounts represent half of recurring revenue and 25% of platform organizations.
            </div>
          </div>
          s
        </AdminPanel>
      </section>

      <AdminPanel title="Recent invoices" description="Platform subscription billing" className="mt-[18px]">
        <div className="overflow-x-auto">
          <table className="min-w-[850px]">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Organization</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Issued</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <strong>{invoice.id}</strong>
                  </td>
                  <td>{invoice.organization}</td>
                  <td>{invoice.plan}</td>
                  <td>
                    <strong>{invoice.amount}</strong>
                  </td>
                  <td>{invoice.issued}</td>
                  <td>
                    <AdminStatus value={invoice.status} />
                  </td>
                  <td>
                    <button aria-label={`Actions for ${invoice.id}`} className="border-0 bg-transparent text-[#8793a2]">
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminTableFooter shown={invoices.length} total={invoices.length} />
      </AdminPanel>
    </>
  );
}
