import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, ChevronRight, Filter, MapPin, MoreHorizontal, Plus, Search, Smartphone, Target, Users, WifiOff, X } from 'lucide-react'
import './field-operations.css'
import './field-worker-form.css'

type WorkerStatus = 'Active' | 'Offline' | 'Needs follow-up'
type FieldWorker = { name:string; initials:string; assignment:string; location:string; today:number; target:number; total:number; flagged:number; sync:string; status:WorkerStatus }

const workers: FieldWorker[] = [
  { name:'Mary Kamara', initials:'MK', assignment:'CHA Baseline v3', location:'Paynesville', today:22, target:20, total:542, flagged:3, sync:'4 min ago', status:'Active' },
  { name:'James Thompson', initials:'JT', assignment:'MHS Field Survey', location:'Sinkor', today:17, target:20, total:518, flagged:8, sync:'19 min ago', status:'Active' },
  { name:'Sarah Dolo', initials:'SD', assignment:'CHA Baseline v3', location:'Congo Town', today:14, target:18, total:475, flagged:2, sync:'1h ago', status:'Active' },
  { name:'David Nyan', initials:'DN', assignment:'Water Point Census', location:'Bong County', today:6, target:16, total:442, flagged:11, sync:'Yesterday', status:'Needs follow-up' },
  { name:'Esther Johnson', initials:'EJ', assignment:'MHS Field Survey', location:'Central Monrovia', today:0, target:18, total:398, flagged:1, sync:'2 days ago', status:'Offline' },
]

const activity = [
  { day:'Wed', submitted:76, target:92 }, { day:'Thu', submitted:88, target:92 }, { day:'Fri', submitted:94, target:92 },
  { day:'Sat', submitted:71, target:80 }, { day:'Sun', submitted:66, target:80 }, { day:'Mon', submitted:103, target:96 }, { day:'Today', submitted:81, target:96 },
]

export function FieldOperations() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All status')
  const [addWorkerOpen, setAddWorkerOpen] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const openWorkerForm = () => { setDrawerClosing(false); setAddWorkerOpen(true) }
  const closeWorkerForm = () => { setDrawerClosing(true); window.setTimeout(() => setAddWorkerOpen(false), 220) }
  const visible = useMemo(() => workers.filter(worker =>
    `${worker.name} ${worker.assignment} ${worker.location}`.toLowerCase().includes(query.toLowerCase()) &&
    (status === 'All status' || worker.status === status)
  ), [query, status])

  return <div className="field-operations">
    <div className="fo-head"><div><p className="eyebrow">DATA COLLECTION</p><h1>Field operations</h1><p>Track field teams, daily collection progress, coverage, and device connectivity.</p></div><button className="fo-add" onClick={openWorkerForm}><Plus size={16}/>Add field worker</button></div>
    <section className="fo-metrics">
      <article><div><small>ACTIVE TODAY</small><strong>28</strong><p>of 33 assigned workers</p></div><span className="fo-icon blue"><Users size={19}/></span></article>
      <article><div><small>SUBMISSIONS TODAY</small><strong>482</strong><p><b>+9.6%</b> above yesterday</p></div><span className="fo-icon green"><CheckCircle2 size={19}/></span></article>
      <article><div><small>DAILY TARGET</small><strong>84%</strong><p>482 of 575 expected</p></div><span className="fo-icon violet"><Target size={19}/></span></article>
      <article><div><small>NEEDS ATTENTION</small><strong>5</strong><p>workers or devices</p></div><span className="fo-icon coral"><AlertTriangle size={19}/></span></article>
    </section>

    <section className="fo-grid">
      <article className="fo-panel fo-chart-panel"><header><div><h2>Daily collection pace</h2><p>Submissions received against the team target</p></div><button aria-label="Chart options"><MoreHorizontal size={18}/></button></header><div className="fo-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={activity} margin={{top:8,right:12,left:-18,bottom:0}}><CartesianGrid stroke="#edf1f5" vertical={false}/><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize:10,fill:'#8290a5'}}/><YAxis tickLine={false} axisLine={false} tick={{fontSize:9,fill:'#98a3b2'}}/><Tooltip/><Bar dataKey="target" fill="#e5ebf5" radius={[3,3,0,0]} barSize={14}/><Bar dataKey="submitted" fill="#0b51b7" radius={[3,3,0,0]} barSize={14}/></BarChart></ResponsiveContainer></div><footer><span><i className="actual"/>Submitted <b>482</b></span><span><i/>Target <b>575</b></span><button>View daily report <ChevronRight size={14}/></button></footer></article>
      <article className="fo-panel fo-coverage"><header><div><h2>Coverage today</h2><p>Active collection areas</p></div><button>View map</button></header><div className="fo-map"><div className="map-ring r-one"/><div className="map-ring r-two"/><span className="pin p-one"><MapPin size={14}/></span><span className="pin p-two"><MapPin size={14}/></span><span className="pin p-three"><MapPin size={14}/></span><div className="map-label"><strong>19</strong><span>districts reporting</span></div></div><div className="coverage-list"><div><span><i className="coverage-dot live"/>Reporting now</span><strong>19</strong></div><div><span><i className="coverage-dot quiet"/>No activity today</span><strong>4</strong></div></div></article>
    </section>

    <section className="fo-attention"><div><span className="warning"><WifiOff size={16}/></span><p><strong>2 devices have not synced in more than 24 hours</strong><small>Esther Johnson and Moses Doe may need connectivity support.</small></p><button>View devices <ChevronRight size={14}/></button></div><div><span className="danger"><AlertTriangle size={16}/></span><p><strong>David Nyan is below 50% of today’s target</strong><small>6 of 16 expected submissions received.</small></p><button>Open worker <ChevronRight size={14}/></button></div></section>

    <section className="fo-table-card"><div className="fo-table-head"><div><h2>Field team</h2><p>{visible.length} workers shown · updated 4 minutes ago</p></div><div><label><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search worker or location"/></label><select value={status} onChange={event => setStatus(event.target.value)}><option>All status</option><option>Active</option><option>Offline</option><option>Needs follow-up</option></select><button><Filter size={15}/>Filters</button></div></div><div className="fo-scroll"><table><thead><tr><th>Field worker</th><th>Assignment</th><th>Location</th><th>Today / target</th><th>Total records</th><th>Review flags</th><th>Last sync</th><th>Status</th><th/></tr></thead><tbody>{visible.map(worker => {const progress=Math.min(100,Math.round(worker.today/worker.target*100));return <tr key={worker.name}><td><div className="worker"><span>{worker.initials}</span><strong>{worker.name}</strong></div></td><td>{worker.assignment}</td><td><span className="worker-location"><MapPin size={12}/>{worker.location}</span></td><td><div className="target-progress"><div><strong>{worker.today}</strong><span>/ {worker.target}</span><b>{progress}%</b></div><i><em style={{width:`${progress}%`}}/></i></div></td><td><strong>{worker.total}</strong></td><td><span className={`flag-count ${worker.flagged > 7 ? 'high' : ''}`}>{worker.flagged}</span></td><td><span className="sync-time"><Smartphone size={13}/>{worker.sync}</span></td><td><span className={`worker-status ${worker.status.toLowerCase().replace(' ','-')}`}><i/>{worker.status}</span></td><td><button className="row-more" aria-label={`Actions for ${worker.name}`}><MoreHorizontal size={18}/></button></td></tr>})}</tbody></table></div><footer><span>Showing 1–{visible.length} of 33 field workers</span><div><button disabled>‹</button><button className="current">1</button><button>2</button><button>›</button></div></footer></section>
    {addWorkerOpen && <div className={`fo-drawer-backdrop ${drawerClosing ? 'closing' : ''}`} onClick={closeWorkerForm}><form className="fo-drawer" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); closeWorkerForm() }}><header><div><p className="eyebrow">FIELD TEAM</p><h2>Add field worker</h2><p>Assign a new worker to a data-collection project.</p></div><button type="button" onClick={closeWorkerForm} aria-label="Close form"><X size={19}/></button></header><div className="fo-drawer-body"><div className="fo-form-grid"><label>Full name<input required placeholder="e.g. Fatima Kamara"/></label><label>Work phone<input type="tel" placeholder="e.g. +231 77 000 0000"/></label></div><label>Project<select required defaultValue=""><option value="" disabled>Select a project</option><option>Community Health Assessment</option><option>Maternal Health Survey</option><option>Water Access Mapping</option><option>Youth Employment Study</option></select></label><label>Assigned form<select required defaultValue=""><option value="" disabled>Select a form</option><option>CHA Baseline v3</option><option>MHS Field Survey</option><option>Water Point Census</option><option>YES Follow-up</option></select></label><div className="fo-form-grid"><label>Primary location<input placeholder="e.g. Paynesville"/></label><label>Daily target<input type="number" min="1" defaultValue="18"/></label></div><label>Device ID <span className="optional">Optional</span><input placeholder="e.g. Samsung SM-A135F"/></label><label className="fo-check"><input type="checkbox" defaultChecked/><span><strong>Send invitation</strong><small>Send the worker a link to join this workspace.</small></span></label></div><footer><button type="button" onClick={closeWorkerForm}>Cancel</button><button className="save" type="submit"><Plus size={15}/>Add field worker</button></footer></form></div>}
  </div>
}
