import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileCheck2, FileText, ListChecks, MapPin, MoreHorizontal, Plus, RefreshCw, Users } from 'lucide-react'
import { api } from '../../services/mockApi'

const overviewData = [
  { month: 'Mar', records: 310, verified: 260 }, { month: 'Apr', records: 520, verified: 430 },
  { month: 'May', records: 460, verified: 410 }, { month: 'Jun', records: 880, verified: 690 },
  { month: 'Jul', records: 1320, verified: 1010 }, { month: 'Aug', records: 1842, verified: 1510 },
]
const projectOwners = ['Amara Johnson', 'David Okoth', 'Samuel K.', 'Lina Mensah']
const projectDates = ['30 Sep 2026', '15 Oct 2026', '05 Sep 2026', '20 Nov 2026']
const reviewCounts = [24, 9, 42, 18]
const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1)
const panelClass = 'border border-[#eceff5] bg-white shadow-[0_2px_5px_rgba(48,62,103,0.035)]'
const panelHeaderClass = 'flex h-[74px] min-h-[49px] items-center justify-between border-b border-[#e9eef3] px-[15px]'
const panelHeadingClass = 'm-0 text-[13px] text-[#303e67]'
const panelDescriptionClass = 'mb-0 mt-[3px] text-[10px] text-[#7081b9]'
const tableIconClasses = [
  'bg-[rgba(11,81,183,0.08)] text-[#0b51b7]',
  'bg-[#edf3fb] text-[#3d73b6]',
  'bg-[#fff4e7] text-[#c87c1d]',
  'bg-[#f1ecf8] text-[#7859aa]',
]

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const [activeProject, setActiveProject] = useState(0)
  const [month, setMonth] = useState(7)
  const selected = projects[activeProject]
  const monthLabel = useMemo(() => new Date(2026, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' }), [month])
  if (isLoading || !selected) return <div className="rounded-[10px] bg-white p-[60px] text-center text-[#758092]">Loading project workspace…</div>

  return <div className="text-[#000444]">
    <div className="mb-5 flex items-start justify-between max-[720px]:flex-col max-[720px]:gap-3">
      <div>
        <p className="!mb-[6px] !mt-0 !text-[11px] !font-bold !uppercase !leading-[1.4] !tracking-[.08em] !text-[#0b51b7]">PROGRAM OPERATIONS</p>
        <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px] !text-[#303e67]">Projects dashboard</h1>
        <p className="m-0 text-[13px] text-[#7081b9]">Monitor every connected collection program from setup through reporting.</p>
      </div>
      <button className="flex cursor-pointer items-center gap-[7px] rounded-[5px] border-0 bg-[#0b51b7] px-[13px] py-[9px] font-sans text-[12px] font-semibold leading-normal text-white shadow-[0_5px_12px_rgba(11,81,183,0.18)]"><Plus size={16}/>New project</button>
    </div>

    <section className="mb-4 grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[720px]:grid-cols-1">
      <article className="flex min-h-[76px] items-center justify-between rounded-[7px] border border-[#eceff5] bg-white px-4 py-[13px] shadow-[0_2px_5px_rgba(48,62,103,0.035)]">
        <div><small className="block text-[11px] font-bold text-[#303e67]">PROJECTS</small><strong className="mt-1 block text-[20px] text-[#35445e]">7</strong><p className="mb-0 mt-[3px] text-[10px] text-[#7081b9]"><b className="text-[#1aa47c]">4</b> collecting now</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgba(11,81,183,0.08)] text-[#0b51b7]"><BarChart3 size={21}/></span>
      </article>
      <article className="flex min-h-[76px] items-center justify-between rounded-[7px] border border-[#eceff5] bg-white px-4 py-[13px] shadow-[0_2px_5px_rgba(48,62,103,0.035)] max-[1100px]:border-r-0 max-[720px]:border-r">
        <div><small className="block text-[11px] font-bold text-[#303e67]">FORMS & SOURCES</small><strong className="mt-1 block text-[20px] text-[#35445e]">11</strong><p className="mb-0 mt-[3px] text-[10px] text-[#7081b9]"><em className="not-italic text-[#1aa47c]">9 connected</em> · 2 drafts</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgba(11,81,183,0.08)] text-[#0b51b7]"><FileCheck2 size={21}/></span>
      </article>
      <article className="flex min-h-[76px] items-center justify-between rounded-[7px] border border-[#eceff5] bg-white px-4 py-[13px] shadow-[0_2px_5px_rgba(48,62,103,0.035)]">
        <div><small className="block text-[11px] font-bold text-[#303e67]">SUBMISSIONS</small><strong className="mt-1 block text-[20px] text-[#35445e]">8,648</strong><p className="mb-0 mt-[3px] text-[10px] text-[#7081b9]">1,126 collected this week</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgba(11,81,183,0.08)] text-[#0b51b7]"><FileText size={21}/></span>
      </article>
      <article className="flex min-h-[76px] items-center justify-between rounded-[7px] border border-[#eceff5] bg-white px-4 py-[13px] shadow-[0_2px_5px_rgba(48,62,103,0.035)]">
        <div><small className="block text-[11px] font-bold text-[#303e67]">COLLECTION PROGRESS</small><strong className="mt-1 block text-[20px] text-[#35445e]">72%</strong><p className="mb-0 mt-[3px] text-[10px] text-[#7081b9]">6,920 of 9,600 target</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgba(11,81,183,0.08)] text-[#0b51b7]"><Activity size={21}/></span>
      </article>
    </section>

    <section className="mb-4 grid grid-cols-[minmax(0,2.05fr)_minmax(260px,1fr)] gap-4 max-[1100px]:grid-cols-1">
      <article className={panelClass}>
        <header className={panelHeaderClass}>
          <div><h2 className={panelHeadingClass}>Collection overview</h2><p className={panelDescriptionClass}>Records received and verified across active projects</p></div>
          <button className="cursor-pointer border-0 bg-transparent text-[#8492a7]" aria-label="Overview options"><MoreHorizontal size={18}/></button>
        </header>
        <div className="h-[238px] px-3 pb-[2px] pt-[15px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={overviewData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="recordsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0b51b7" stopOpacity=".16"/><stop offset="100%" stopColor="#0b51b7" stopOpacity=".01"/></linearGradient></defs><CartesianGrid stroke="#eceff5" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#7081b9', fontSize: 10 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#7081b9', fontSize: 9 }}/><Tooltip/><Area type="monotone" dataKey="records" stroke="#0b51b7" strokeWidth={2.5} fill="url(#recordsFill)"/><Area type="monotone" dataKey="verified" stroke="#22b783" strokeWidth={2} fill="none" strokeDasharray="4 3"/></AreaChart></ResponsiveContainer></div>
        <footer className="mx-[15px] mb-[14px] flex items-center gap-[18px] bg-[rgba(11,81,183,0.08)] px-[14px] py-3 text-[10px] text-[#77869a] max-[720px]:flex-wrap max-[720px]:items-start">
          <div className="flex items-center gap-[5px]"><span className="h-[7px] w-[7px] rounded-full bg-[#0b51b7]"/>Received <strong className="text-[#3c4b62]">8,648</strong></div>
          <div className="flex items-center gap-[5px]"><span className="h-[7px] w-[7px] rounded-full bg-[#22b783]"/>Verified <strong className="text-[#3c4b62]">7,412</strong></div>
          <button className="ml-auto flex items-center justify-center gap-[6px] border-0 bg-transparent font-sans text-[10px] font-semibold leading-normal text-[#0b51b7] max-[720px]:m-0 max-[720px]:w-full"><CalendarDays size={14}/>01 Mar 2026 to 19 Aug 2026</button>
        </footer>
      </article>
      <article className={`${panelClass} pb-3 max-[1100px]:hidden`}>
        <header className={panelHeaderClass}><div><h2 className={panelHeadingClass}>Collection calendar</h2><p className={panelDescriptionClass}>Deadlines and field events</p></div></header>
        <div className="flex items-center justify-between px-[22px] pb-3 pt-[18px]"><button className="cursor-pointer border-0 bg-transparent text-[#7f8b9d]" onClick={() => setMonth(value => value - 1)}><ChevronLeft size={17}/></button><strong className="text-[12px] text-[#303e67]">{monthLabel}</strong><button className="cursor-pointer border-0 bg-transparent text-[#7f8b9d]" onClick={() => setMonth(value => value + 1)}><ChevronRight size={17}/></button></div>
        <div className="grid grid-cols-7 px-[13px]">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span className="py-[7px] text-center text-[9px] font-bold text-[#536178]" key={day}>{day}</span>)}</div>
        <div className="grid grid-cols-7 px-[13px]"><i className="block"/><i className="block"/><i className="block"/><i className="block"/><i className="block"/>{calendarDays.map(day => <button className={`relative h-[29px] cursor-pointer border-0 bg-transparent font-sans text-[10px] leading-normal text-[#69768a] ${day === 19 ? 'rounded-[3px] bg-[rgba(11,81,183,0.08)] font-bold text-[#0b51b7]' : day === 27 ? "after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:rounded-full after:bg-[#fd3c97] after:content-['']" : ''}`} key={day}>{day}</button>)}</div>
        <div className="mx-[15px] mb-0 mt-[10px] flex gap-2 bg-[#fafbfd] p-[9px]"><span className="w-[3px] rounded-[2px] bg-[#fd3c97]"/><div><strong className="block text-[10px]">Water mapping closes</strong><small className="mt-[3px] block text-[9px] text-[#8b98aa]">27 Aug · Bong County</small></div></div>
      </article>
    </section>

    <section className="mb-4 grid grid-cols-[minmax(280px,0.86fr)_minmax(0,2.14fr)] gap-4 max-[1100px]:grid-cols-1">
      <article className={`${panelClass} pb-[14px]`}>
        <header className={panelHeaderClass}><div><h2 className={panelHeadingClass}>Collection performance</h2><p className={panelDescriptionClass}>Portfolio target status</p></div><button className="cursor-pointer border-0 bg-transparent text-[#8492a7]" aria-label="Performance options"><MoreHorizontal size={18}/></button></header>
        <div className="relative mx-auto mb-1 mt-[13px] h-[190px] w-[190px]">
          <svg className="h-full w-full rotate-[135deg]" viewBox="0 0 190 190" role="img" aria-label="72 percent collection progress"><circle className="fill-none [stroke-linecap:round] [stroke-width:9] [stroke:#edf2f8]" cx="95" cy="95" r="67"/><circle className="fill-none [stroke-dasharray:72_28] [stroke-linecap:round] [stroke-width:9] [stroke:#0b51b7]" cx="95" cy="95" r="67" pathLength="100"/><circle className="fill-none [stroke-linecap:round] [stroke-width:9] [stroke:#edf2f8]" cx="95" cy="95" r="52"/><circle className="fill-none [stroke-dasharray:61_39] [stroke-linecap:round] [stroke-width:9] [stroke:#6d81f5]" cx="95" cy="95" r="52" pathLength="100"/><circle className="fill-none [stroke-linecap:round] [stroke-width:9] [stroke:#edf2f8]" cx="95" cy="95" r="37"/><circle className="fill-none [stroke-dasharray:45_55] [stroke-linecap:round] [stroke-width:9] [stroke:#c7d3f4]" cx="95" cy="95" r="37" pathLength="100"/></svg>
          <div className="absolute inset-0 grid place-content-center text-center"><strong className="text-[24px]">72%</strong><small className="text-[9px] text-[#94a0b1]">overall</small></div>
        </div>
        <div className="flex justify-center gap-3 px-3"><span className="text-[9px] text-[#8693a5]"><i className="mr-1 inline-block h-[6px] w-[6px] rounded-full bg-[#0b51b7]"/>Verified <b className="text-[#4c5b70]">61%</b></span><span className="text-[9px] text-[#8693a5]"><i className="mr-1 inline-block h-[6px] w-[6px] rounded-full bg-[#6d81f5]"/>Received <b className="text-[#4c5b70]">72%</b></span><span className="text-[9px] text-[#8693a5]"><i className="mr-1 inline-block h-[6px] w-[6px] rounded-full bg-[#c7d3f4]"/>Target <b className="text-[#4c5b70]">100%</b></span></div>
        <button className="mx-[15px] mb-0 mt-[15px] flex w-[calc(100%-30px)] items-center justify-center gap-[6px] border-0 bg-[rgba(11,81,183,0.08)] p-[11px] font-sans text-[10px] font-semibold leading-normal text-[#0b51b7]"><CalendarDays size={14}/>Current collection period</button>
      </article>
      <article className={panelClass}>
        <div className="flex h-[49px] border-b border-[#e8edf3]">{projects.slice(0,3).map((project,index) => <button className={`relative cursor-pointer border-0 bg-transparent px-[18px] font-sans text-[11px] font-semibold leading-normal max-[720px]:px-[10px] ${activeProject === index ? "text-[#0b51b7] after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-[#0b51b7] after:content-['']" : 'text-[#617087]'}`} onClick={() => setActiveProject(index)} key={project.name}>{project.name.split(' ')[0]} {index + 1}</button>)}</div>
        <div className="flex items-center justify-between p-4 max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-3">
          <div className="flex items-center gap-[9px]"><span className="grid h-[37px] w-[37px] place-items-center rounded-full bg-[rgba(11,81,183,0.08)] text-[#0b51b7]"><FileText size={18}/></span><div><h2 className="m-0 text-[14px] text-[#303e67]">{selected.name}</h2><p className="mb-0 mt-1 flex items-center gap-[3px] text-[10px] text-[#8592a5]"><MapPin size={12}/>{selected.sector}</p></div></div>
          <div className="text-right"><small className="block text-[9px] text-[#8d99aa]">STARTED · 02 JUN 2026</small><strong className="mt-1 block text-[9px] text-[#4f5e72]">ENDS · {projectDates[activeProject]}</strong></div>
        </div>
        <div className="grid grid-cols-4 px-[18px] pb-[15px] pt-2">
          <div className="relative text-center before:absolute before:left-[-50%] before:right-1/2 before:top-3 before:h-px before:bg-[#dfe6ef] before:content-[''] first:before:hidden"><i className="relative z-[1] mx-auto mb-[7px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-[#7e91aa] bg-[#7e91aa] text-[9px] not-italic text-white"><CheckCircle2 size={15}/></i><strong className="block text-[9px] uppercase text-[#68768a] max-[720px]:text-[7px]">Source connected</strong></div>
          <div className="relative text-center before:absolute before:left-[-50%] before:right-1/2 before:top-3 before:h-px before:bg-[#dfe6ef] before:content-['']"><i className="relative z-[1] mx-auto mb-[7px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-[#7e91aa] bg-[#7e91aa] text-[9px] not-italic text-white"><CheckCircle2 size={15}/></i><strong className="block text-[9px] uppercase text-[#68768a] max-[720px]:text-[7px]">Field setup</strong></div>
          <div className="relative text-center before:absolute before:left-[-50%] before:right-1/2 before:top-3 before:h-px before:bg-[#dfe6ef] before:content-['']"><i className="relative z-[1] mx-auto mb-[7px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-[#0b51b7] bg-white text-[9px] font-bold not-italic text-[#0b51b7] shadow-[0_0_0_3px_rgba(11,81,183,0.08)]">3</i><strong className="block text-[9px] uppercase text-[#0b51b7] max-[720px]:text-[7px]">Live collection</strong></div>
          <div className="relative text-center before:absolute before:left-[-50%] before:right-1/2 before:top-3 before:h-px before:bg-[#dfe6ef] before:content-['']"><i className="relative z-[1] mx-auto mb-[7px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-[#d8e0e9] bg-white text-[9px] not-italic text-[#7e8ca0]">4</i><strong className="block text-[9px] uppercase text-[#68768a] max-[720px]:text-[7px]">Review & close</strong></div>
        </div>
        <div className="flex items-center gap-[22px] border-y border-[#edf1f5] px-4 py-[10px] text-[10px] text-[#8895a8] max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-[7px]"><span>Form: <strong className="text-[#546278]">{selected.form}</strong></span><span>Last sync: <strong className="text-[#546278]">{selected.sync}</strong></span><span className="ml-auto flex items-center gap-[3px] rounded-[3px] bg-[rgba(253,60,151,0.15)] px-[6px] py-1 text-[#fd3c97] max-[720px]:m-0"><Clock3 size={12}/>42 days left</span></div>
        <p className="mx-4 mb-3 mt-[14px] text-[10px] leading-[1.5] text-[#7081b9]">Field teams are collecting household records. Monitor submission pace, team coverage, and sync health before the collection window closes.</p>
        <div className="px-4 pb-[14px]"><div className="flex justify-between text-[9px] text-[#7c899d]"><span>Collection progress</span><strong className="text-[#68778d]">{selected.progress}% Complete</strong></div><i className="mt-[7px] block h-1 bg-[#edf1f5]"><b className="block h-full bg-[#0b51b7]" style={{width:`${selected.progress}%`}}/></i></div>
        <div className="flex items-center justify-between border-t border-[#e9eef3] px-4 py-3 max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-3">
          <div className="flex"><span className="mr-[-5px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-white bg-[#dfeaf7] text-[8px] font-bold text-[#316a9e]">AJ</span><span className="mr-[-5px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-white bg-[#f2dfde] text-[8px] font-bold text-[#a96060]">DO</span><span className="mr-[-5px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-white bg-[#e1eee6] text-[8px] font-bold text-[#397859]">SK</span><span className="mr-[-5px] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-white bg-[#eef1f5] text-[8px] font-bold text-[#68778b]">+9</span></div>
          <div className="flex items-center gap-[14px]"><span className="flex items-center gap-1 text-[9px] text-[#758398]"><ListChecks size={14}/>{reviewCounts[activeProject]} to review</span><span className="flex items-center gap-1 text-[9px] text-[#758398]"><Users size={14}/>12 field staff</span><NavLink className="flex items-center gap-1 text-[9px] font-bold text-[#0b51b7] no-underline" to={`/projects/${activeProject + 1}`}>Open project <ChevronRight size={14}/></NavLink></div>
        </div>
      </article>
    </section>

    <section className="mb-4 grid grid-cols-[minmax(0,2.1fr)_minmax(280px,1fr)] gap-4 max-[1100px]:grid-cols-1">
      <article className={panelClass}>
        <header className={panelHeaderClass}><div><h2 className={panelHeadingClass}>All projects</h2><p className={panelDescriptionClass}>Connected programs in this workspace</p></div><NavLink className="text-[10px] text-[#0b51b7] no-underline" to="/projects">View all</NavLink></header>
        <div>
          <div className="grid grid-cols-[1.55fr_1fr_0.8fr_0.62fr_0.75fr] items-center gap-3 bg-[#f5f7fa] px-[15px] py-[10px] text-[9px] font-bold text-[#6f7d91] max-[720px]:hidden"><span>Project name</span><span>Owner</span><span>Deadline</span><span>Status</span><span>Progress</span></div>
          {projects.map((project,index) => <div className="grid grid-cols-[1.55fr_1fr_0.8fr_0.62fr_0.75fr] items-center gap-3 border-t border-[#eef2f5] px-[15px] py-[10px] text-[9px] text-[#7081b9] max-[720px]:grid-cols-[1fr_auto]" key={project.name}>
            <NavLink className="flex items-center gap-2 text-[#36445a] no-underline" to={`/projects/${index + 1}`}><span className={`grid h-[27px] w-[27px] flex-none place-items-center rounded-full ${tableIconClasses[index] ?? tableIconClasses[0]}`}><FileText size={14}/></span><div><strong className="block text-[10px]">{project.name}</strong><small className="mt-[3px] block text-[8px] text-[#94a0b1]">{project.form}</small></div></NavLink>
            <span className="flex items-center gap-[5px] max-[720px]:hidden"><i className="grid h-[21px] w-[21px] place-items-center rounded-full bg-[rgba(11,81,183,0.08)] text-[7px] font-bold not-italic text-[#0b51b7]">{projectOwners[index].split(' ').map(name => name[0]).join('')}</i>{projectOwners[index]}</span>
            <span className="max-[720px]:hidden">{projectDates[index]}</span>
            <span className={`w-max rounded-[3px] px-[6px] py-1 text-[8px] font-bold max-[720px]:hidden ${project.status === 'Active' ? 'bg-[rgba(34,183,131,0.15)] text-[#22b783]' : 'bg-[rgba(255,159,67,0.15)] text-[#ff9f43]'}`}>{project.status}</span>
            <div className="flex items-center gap-[7px]"><i className="block h-[3px] w-[45px] bg-[#edf1f5]"><b className="block h-full bg-[#22b783]" style={{width:`${project.progress}%`}}/></i><strong className="text-[9px]">{project.progress}%</strong></div>
          </div>)}
        </div>
      </article>
      <article className={panelClass}>
        <header className={panelHeaderClass}><div><h2 className={panelHeadingClass}>Activity</h2><p className={panelDescriptionClass}>Latest program events</p></div><button className="cursor-pointer rounded-[3px] border border-[#e2e8ef] bg-white px-2 py-[5px] text-[9px] text-[#8492a7]">All⌄</button></header>
        <ol className="m-0 list-none px-[15px] py-2">
          <li className="flex gap-[9px] border-b border-[#edf1f5] py-[10px]"><span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-current text-[#22b783]"><RefreshCw size={14}/></span><p className="m-0"><strong className="block text-[10px] text-[#526075]">184 new submissions synced</strong><small className="mt-1 block text-[9px] text-[#7081b9]">Community Health · 8 min ago</small></p></li>
          <li className="flex gap-[9px] border-b border-[#edf1f5] py-[10px]"><span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-current text-[#fd3c97]"><ListChecks size={14}/></span><p className="m-0"><strong className="block text-[10px] text-[#526075]">24 records sent for review</strong><small className="mt-1 block text-[9px] text-[#7081b9]">Water Mapping · 42 min ago</small></p></li>
          <li className="flex gap-[9px] border-b border-[#edf1f5] py-[10px]"><span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-current text-[#0b51b7]"><Users size={14}/></span><p className="m-0"><strong className="block text-[10px] text-[#526075]">Samuel joined the field team</strong><small className="mt-1 block text-[9px] text-[#7081b9]">Youth Study · Today, 09:14</small></p></li>
          <li className="flex gap-[9px] py-[10px]"><span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-current text-[#ff9f43]"><FileCheck2 size={14}/></span><p className="m-0"><strong className="block text-[10px] text-[#526075]">Form version 3 published</strong><small className="mt-1 block text-[9px] text-[#7081b9]">Maternal Health · Yesterday</small></p></li>
        </ol>
      </article>
    </section>
  </div>
}
