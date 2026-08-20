import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileCheck2, FileText, ListChecks, MapPin, MoreHorizontal, Plus, RefreshCw, Users } from 'lucide-react'
import { api } from './mockApi'
import './projects-index.css'
import './projects-palette.css'

const overviewData = [
  { month: 'Mar', records: 310, verified: 260 }, { month: 'Apr', records: 520, verified: 430 },
  { month: 'May', records: 460, verified: 410 }, { month: 'Jun', records: 880, verified: 690 },
  { month: 'Jul', records: 1320, verified: 1010 }, { month: 'Aug', records: 1842, verified: 1510 },
]
const projectOwners = ['Amara Johnson', 'David Okoth', 'Samuel K.', 'Lina Mensah']
const projectDates = ['30 Sep 2026', '15 Oct 2026', '05 Sep 2026', '20 Nov 2026']
const reviewCounts = [24, 9, 42, 18]
const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1)

export function ProjectsIndex() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const [activeProject, setActiveProject] = useState(0)
  const [month, setMonth] = useState(7)
  const selected = projects[activeProject]
  const monthLabel = useMemo(() => new Date(2026, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' }), [month])
  if (isLoading || !selected) return <div className="loading">Loading project workspace…</div>

  return <div className="projects-index">
    <div className="pi-head">
      <div><p className="eyebrow">PROGRAM OPERATIONS</p><h1>Projects dashboard</h1><p>Monitor every connected collection program from setup through reporting.</p></div>
      <button className="pi-create"><Plus size={16}/>New project</button>
    </div>

    <section className="pi-metrics">
      <article><div><small>PROJECTS</small><strong>7</strong><p><b>4</b> collecting now</p></div><span className="pi-icon violet"><BarChart3 size={21}/></span></article>
      <article><div><small>FORMS & SOURCES</small><strong>11</strong><p><em>9 connected</em> · 2 drafts</p></div><span className="pi-icon blue"><FileCheck2 size={21}/></span></article>
      <article><div><small>SUBMISSIONS</small><strong>8,648</strong><p>1,126 collected this week</p></div><span className="pi-icon amber"><FileText size={21}/></span></article>
      <article><div><small>COLLECTION PROGRESS</small><strong>72%</strong><p>6,920 of 9,600 target</p></div><span className="pi-icon teal"><Activity size={21}/></span></article>
    </section>

    <section className="pi-grid pi-overview-row">
      <article className="pi-panel pi-overview">
        <header><div><h2>Collection overview</h2><p>Records received and verified across active projects</p></div><button aria-label="Overview options"><MoreHorizontal size={18}/></button></header>
        <div className="pi-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={overviewData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="recordsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0b51b7" stopOpacity=".16"/><stop offset="100%" stopColor="#0b51b7" stopOpacity=".01"/></linearGradient></defs><CartesianGrid stroke="#eceff5" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#7081b9', fontSize: 10 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#7081b9', fontSize: 9 }}/><Tooltip/><Area type="monotone" dataKey="records" stroke="#0b51b7" strokeWidth={2.5} fill="url(#recordsFill)"/><Area type="monotone" dataKey="verified" stroke="#22b783" strokeWidth={2} fill="none" strokeDasharray="4 3"/></AreaChart></ResponsiveContainer></div>
        <footer><div><span className="dot records"/>Received <strong>8,648</strong></div><div><span className="dot verified"/>Verified <strong>7,412</strong></div><button><CalendarDays size={14}/>01 Mar 2026 to 19 Aug 2026</button></footer>
      </article>
      <article className="pi-panel pi-calendar">
        <header><div><h2>Collection calendar</h2><p>Deadlines and field events</p></div></header>
        <div className="calendar-nav"><button onClick={() => setMonth(value => value - 1)}><ChevronLeft size={17}/></button><strong>{monthLabel}</strong><button onClick={() => setMonth(value => value + 1)}><ChevronRight size={17}/></button></div>
        <div className="weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid"><i/><i/><i/><i/><i/>{calendarDays.map(day => <button className={day === 19 ? 'today' : day === 27 ? 'event' : ''} key={day}>{day}</button>)}</div>
        <div className="calendar-event"><span/><div><strong>Water mapping closes</strong><small>27 Aug · Bong County</small></div></div>
      </article>
    </section>

    <section className="pi-grid pi-performance-row">
      <article className="pi-panel pi-performance"><header><div><h2>Collection performance</h2><p>Portfolio target status</p></div><button aria-label="Performance options"><MoreHorizontal size={18}/></button></header><div className="rings"><svg viewBox="0 0 190 190" role="img" aria-label="72 percent collection progress"><circle className="ring-bg r1" cx="95" cy="95" r="67"/><circle className="ring-value v1" cx="95" cy="95" r="67" pathLength="100"/><circle className="ring-bg r2" cx="95" cy="95" r="52"/><circle className="ring-value v2" cx="95" cy="95" r="52" pathLength="100"/><circle className="ring-bg r3" cx="95" cy="95" r="37"/><circle className="ring-value v3" cx="95" cy="95" r="37" pathLength="100"/></svg><div><strong>72%</strong><small>overall</small></div></div><div className="ring-legend"><span><i className="completed"/>Verified <b>61%</b></span><span><i className="active"/>Received <b>72%</b></span><span><i className="target"/>Target <b>100%</b></span></div><button className="period"><CalendarDays size={14}/>Current collection period</button></article>
      <article className="pi-panel pi-spotlight">
        <div className="project-tabs">{projects.slice(0,3).map((project,index) => <button className={activeProject === index ? 'active' : ''} onClick={() => setActiveProject(index)} key={project.name}>{project.name.split(' ')[0]} {index + 1}</button>)}</div>
        <div className="spotlight-head"><div className="spotlight-title"><span><FileText size={18}/></span><div><h2>{selected.name}</h2><p><MapPin size={12}/>{selected.sector}</p></div></div><div><small>STARTED · 02 JUN 2026</small><strong>ENDS · {projectDates[activeProject]}</strong></div></div>
        <div className="stages"><div className="done"><i><CheckCircle2 size={15}/></i><strong>Source connected</strong></div><div className="done"><i><CheckCircle2 size={15}/></i><strong>Field setup</strong></div><div className="current"><i>3</i><strong>Live collection</strong></div><div><i>4</i><strong>Review & close</strong></div></div>
        <div className="spotlight-meta"><span>Form: <strong>{selected.form}</strong></span><span>Last sync: <strong>{selected.sync}</strong></span><span className="due"><Clock3 size={12}/>42 days left</span></div>
        <p className="spotlight-copy">Field teams are collecting household records. Monitor submission pace, team coverage, and sync health before the collection window closes.</p>
        <div className="spotlight-progress"><div><span>Collection progress</span><strong>{selected.progress}% Complete</strong></div><i><b style={{width:`${selected.progress}%`}}/></i></div>
        <div className="spotlight-foot"><div className="team-stack"><span>AJ</span><span>DO</span><span>SK</span><span>+9</span></div><div><span><ListChecks size={14}/>{reviewCounts[activeProject]} to review</span><span><Users size={14}/>12 field staff</span><NavLink to={`/projects/${activeProject + 1}`}>Open project <ChevronRight size={14}/></NavLink></div></div>
      </article>
    </section>

    <section className="pi-grid pi-lower-row">
      <article className="pi-panel pi-all-projects"><header><div><h2>All projects</h2><p>Connected programs in this workspace</p></div><NavLink to="/projects">View all</NavLink></header><div className="pi-table"><div className="pi-thead"><span>Project name</span><span>Owner</span><span>Deadline</span><span>Status</span><span>Progress</span></div>{projects.map((project,index) => <div className="pi-trow" key={project.name}><NavLink to={`/projects/${index + 1}`}><span className={`table-icon i-${index}`}><FileText size={14}/></span><div><strong>{project.name}</strong><small>{project.form}</small></div></NavLink><span className="pi-owner"><i>{projectOwners[index].split(' ').map(name => name[0]).join('')}</i>{projectOwners[index]}</span><span>{projectDates[index]}</span><span className={`pi-status ${project.status === 'Active' ? 'active' : 'review'}`}>{project.status}</span><div className="table-progress"><i><b style={{width:`${project.progress}%`}}/></i><strong>{project.progress}%</strong></div></div>)}</div></article>
      <article className="pi-panel pi-activity"><header><div><h2>Activity</h2><p>Latest program events</p></div><button>All⌄</button></header><ol><li><span className="a-teal"><RefreshCw size={14}/></span><p><strong>184 new submissions synced</strong><small>Community Health · 8 min ago</small></p></li><li><span className="a-coral"><ListChecks size={14}/></span><p><strong>24 records sent for review</strong><small>Water Mapping · 42 min ago</small></p></li><li><span className="a-blue"><Users size={14}/></span><p><strong>Samuel joined the field team</strong><small>Youth Study · Today, 09:14</small></p></li><li><span className="a-amber"><FileCheck2 size={14}/></span><p><strong>Form version 3 published</strong><small>Maternal Health · Yesterday</small></p></li></ol></article>
    </section>
  </div>
}
