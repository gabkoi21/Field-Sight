import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2,
  ChevronDown, Clock3, Database, ExternalLink, FileCheck2,
  FolderCheck, MapPinned, MoreHorizontal, RefreshCw, ShieldAlert,
  UsersRound, Wifi,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import './overview.css'
import './overview-actions.css'

const submissionTrend = [
  { day: 'Aug 13', submissions: 246, approved: 218 },
  { day: 'Aug 14', submissions: 310, approved: 279 },
  { day: 'Aug 15', submissions: 284, approved: 260 },
  { day: 'Aug 16', submissions: 372, approved: 331 },
  { day: 'Aug 17', submissions: 341, approved: 308 },
  { day: 'Aug 18', submissions: 448, approved: 402 },
  { day: 'Today', submissions: 516, approved: 461 },
]

const projectPerformance = [
  { name: 'Community Health', actual: 1842, target: 2560 },
  { name: 'Maternal Health', actual: 3104, target: 3700 },
  { name: 'Youth Employment', actual: 2716, target: 4400 },
  { name: 'Water Access', actual: 986, target: 2050 },
]

const qualityData = [
  { name: 'Approved', value: 82, color: '#0b51b7' },
  { name: 'On hold', value: 11, color: '#f0a34a' },
  { name: 'Rejected', value: 4, color: '#d85d67' },
  { name: 'Unreviewed', value: 3, color: '#dce3e8' },
]

const activity = [
  { initials: 'MK', name: 'Mary Kamara', detail: 'submitted 18 records in Paynesville', time: '6 min ago', tone: 'teal' },
  { initials: 'JT', name: 'James Thompson', detail: 'had 4 interviews placed on hold', time: '24 min ago', tone: 'amber' },
  { initials: 'SD', name: 'Sarah Dolo', detail: 'completed the Congo Town assignment', time: '51 min ago', tone: 'blue' },
  { initials: 'DN', name: 'David Nyan', detail: 'synced 12 offline submissions', time: '1 hr ago', tone: 'violet' },
]

const alerts = [
  { icon: ShieldAlert, title: '24 high-severity issues', text: 'Duration and GPS checks need review', action: 'Review queue', tone: 'red' },
  { icon: Wifi, title: '1 source needs attention', text: 'Water Point Census sync is delayed', action: 'View sync', tone: 'amber' },
  { icon: MapPinned, title: '3 locations below target', text: 'Less than 60% of planned interviews', action: 'View coverage', tone: 'blue' },
]

function StatCard({ label, value, change, direction, icon: Icon, tone, note, onClick }:{
  label:string; value:string; change:string; direction:'up'|'down';
  icon:typeof Database; tone:string; note:string; onClick:()=>void
}) {
  return <button className="ov-stat" onClick={onClick}>
    <div className={`ov-stat-icon ${tone}`}><Icon size={19}/></div>
    <div className="ov-stat-copy"><span>{label}</span><strong>{value}</strong></div>
    <div className={`ov-change ${direction}`}>
      {direction === 'up' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {change}
    </div>
    <small>{note}</small>
  </button>
}

function Panel({ title, subtitle, action, children, className='' }:{
  title:string; subtitle?:string; action?:React.ReactNode; children:React.ReactNode; className?:string
}) {
  return <section className={`ov-panel ${className}`}>
    <header className="ov-panel-head">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action ?? <button className="ov-icon-button" aria-label={`More options for ${title}`}><MoreHorizontal size={18}/></button>}
    </header>
    {children}
  </section>
}

export function Overview() {
  const navigate = useNavigate()
  const [project, setProject] = useState('All projects')
  const [period, setPeriod] = useState('Last 7 days')
  const [location, setLocation] = useState('All locations')
  const { isLoading } = useQuery({ queryKey: ['organization-overview'], queryFn: async () => new Promise(resolve => setTimeout(()=>resolve(true), 180)) })
  if (isLoading) return <div className="loading">Loading organization dashboard…</div>

  return <div className="overview-page">
    <div className="ov-heading">
      <div><p className="ov-kicker">COMMUNITY HEALTH INITIATIVE</p><h1>Collection dashboard</h1><p>{project} · {location} · {period}</p></div>
      <div className="ov-heading-actions">
        <label className="ov-select"><FolderCheck size={15}/><select value={project} onChange={event=>setProject(event.target.value)} aria-label="Filter dashboard by project"><option>All projects</option><option>Community Health Assessment</option><option>Maternal Health Survey</option><option>Youth Employment Study</option></select><ChevronDown size={14}/></label>
        <label className="ov-select"><MapPinned size={15}/><select value={location} onChange={event=>setLocation(event.target.value)} aria-label="Filter dashboard by location"><option>All locations</option><option>Montserrado</option><option>Bong County</option><option>Paynesville</option></select><ChevronDown size={14}/></label>
        <label className="ov-select"><CalendarDays size={15}/><select value={period} onChange={event=>setPeriod(event.target.value)} aria-label="Filter dashboard by period"><option>Last 7 days</option><option>Today</option><option>Last 30 days</option></select><ChevronDown size={14}/></label>
        <button className="ov-sync" onClick={()=>navigate('/sync')}><RefreshCw size={15}/>Sync all</button>
      </div>
    </div>

    <section className="ov-briefing" aria-label="Today’s operations briefing">
      <span className="ov-briefing-icon"><AlertTriangle size={19}/></span>
      <div><strong>3 items require attention today</strong><p>24 high-risk records, 1 delayed sync, and 3 locations below target.</p></div>
      <div className="ov-briefing-actions"><button onClick={()=>navigate('/quality')}>Review records</button><button onClick={()=>navigate('/sync')}>Check sync</button><button onClick={()=>navigate('/analytics')}>View coverage</button></div>
    </section>

    <section className="ov-trust" aria-label="Data trust summary">
      <span><CheckCircle2 size={14}/>Data refreshed <strong>8 min ago</strong></span><i/><span><FileCheck2 size={14}/><strong>1,192 records</strong> became export-ready this week</span><i/><span><ShieldAlert size={14}/><strong>149 records</strong> blocked from export</span>
    </section>

    <div className="ov-stats">
      <StatCard label="Total submissions" value="10,284" change="12.4%" direction="up" icon={Database} tone="blue" note="1,306 received this week" onClick={()=>navigate('/submissions')}/>
      <StatCard label="Active projects" value="4" change="1" direction="up" icon={FolderCheck} tone="teal" note="7 projects in the portfolio" onClick={()=>navigate('/projects')}/>
      <StatCard label="Active enumerators" value="28" change="3" direction="up" icon={UsersRound} tone="violet" note="of 33 assigned today" onClick={()=>navigate('/enumerators')}/>
      <StatCard label="Needs review" value="421" change="31" direction="down" icon={ShieldAlert} tone="amber" note="149 blocking export" onClick={()=>navigate('/quality')}/>
    </div>

    <div className="ov-grid ov-grid-primary">
      <Panel title="Submission activity" subtitle="Incoming and approved records across active projects" action={<button className="ov-text-button" onClick={()=>navigate('/submissions')}>View submissions <ExternalLink size={13}/></button>}>
        <div className="ov-chart-legend"><span><i className="submitted"/>Submitted</span><span><i className="approved"/>Approved</span></div>
        <div className="ov-main-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={submissionTrend} margin={{top:10,right:10,left:-22,bottom:0}}>
              <defs><linearGradient id="submittedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b51b7" stopOpacity=".22"/><stop offset="1" stopColor="#0b51b7" stopOpacity="0"/></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#edf0f2"/>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#7d8996',fontSize:11}}/>
              <YAxis axisLine={false} tickLine={false} tick={{fill:'#9aa4ae',fontSize:10}}/>
              <Tooltip contentStyle={{border:'1px solid #e5e8ec',borderRadius:6,fontSize:12}}/>
              <Area type="monotone" dataKey="submissions" stroke="#0b51b7" strokeWidth={2.4} fill="url(#submittedFill)"/>
              <Area type="monotone" dataKey="approved" stroke="#6d81f5" strokeWidth={2} fill="transparent" strokeDasharray="4 3"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Review status" subtitle="Current submission decisions" action={<button className="ov-period">This week<ChevronDown size={13}/></button>}>
        <div className="ov-quality">
          <div className="ov-donut">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={qualityData} dataKey="value" innerRadius={58} outerRadius={74} paddingAngle={2} stroke="none">{qualityData.map(item=><Cell key={item.name} fill={item.color}/>)}</Pie></PieChart></ResponsiveContainer>
            <div><strong>87.2%</strong><span>approved</span></div>
          </div>
          <div className="ov-quality-list">{qualityData.map(item=><div key={item.name}><span><i style={{background:item.color}}/>{item.name}</span><strong>{item.value}%</strong></div>)}</div>
        </div>
        <button className="ov-review-button" onClick={()=>navigate('/quality')}><ShieldAlert size={15}/>Open quality review queue <span>421</span></button>
      </Panel>
    </div>

    <div className="ov-grid ov-grid-secondary">
      <Panel title="Project progress" subtitle="Actual submissions against planned sample" action={<button className="ov-text-button" onClick={()=>navigate('/projects')}>All projects <ExternalLink size={13}/></button>}>
        <div className="ov-project-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={projectPerformance} layout="vertical" margin={{top:0,right:18,left:28,bottom:0}}><CartesianGrid horizontal={false} stroke="#edf0f2"/><XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#87929d'}}/><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={105} tick={{fontSize:11,fill:'#526171'}}/><Tooltip contentStyle={{border:'1px solid #e5e8ec',borderRadius:6,fontSize:12}}/><Bar dataKey="target" fill="#e8edf1" radius={[0,3,3,0]} barSize={12}/><Bar dataKey="actual" fill="#0b51b7" radius={[0,3,3,0]} barSize={12}/></BarChart></ResponsiveContainer></div>
      </Panel>

      <Panel title="Collection health" subtitle="Live operational signals" action={<span className="ov-live"><i/>Live</span>}>
        <div className="ov-health"><div><span className="ov-health-icon green"><CheckCircle2 size={17}/></span><p><strong>3 sources healthy</strong><small>Last checked 8 minutes ago</small></p></div><div><span className="ov-health-icon amber"><Clock3 size={17}/></span><p><strong>1 delayed source</strong><small>Water Point Census · 18 hours</small></p></div><div><span className="ov-health-icon blue"><FileCheck2 size={17}/></span><p><strong>1,192 export-ready</strong><small>Approved since Monday</small></p></div></div>
      </Panel>
    </div>

    <div className="ov-grid ov-grid-bottom">
      <Panel title="Recent field activity" subtitle="Latest enumerator and synchronization events" action={<button className="ov-period">All activity<ChevronDown size={13}/></button>}>
        <div className="ov-activity-list">{activity.map(item=><div className="ov-activity" key={item.name}><span className={`ov-avatar ${item.tone}`}>{item.initials}</span><p><strong>{item.name}</strong> {item.detail}<small>{item.time}</small></p></div>)}</div>
      </Panel>

      <Panel title="Requires attention" subtitle="Exceptions ordered by operational impact" action={<button className="ov-text-button" onClick={()=>navigate('/quality')}>View all <ExternalLink size={13}/></button>}>
        <div className="ov-alert-list">{alerts.map(({icon:Icon,...item}, index)=><div className="ov-alert" key={item.title}><span className={item.tone}><Icon size={17}/></span><p><strong>{item.title}</strong><small>{item.text}</small></p><button onClick={()=>navigate(index===0?'/quality':index===1?'/sync':'/analytics')}>{item.action}</button></div>)}</div>
      </Panel>
    </div>
  </div>
}
