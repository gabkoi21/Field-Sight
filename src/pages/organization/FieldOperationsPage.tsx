import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, ChevronRight, Filter, MapPin, MoreHorizontal, Plus, Search, Smartphone, Target, Users, WifiOff, X } from 'lucide-react'

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

const eyebrowClass = '!m-0 !mb-[6px] text-[11px] !leading-[1.4] font-bold tracking-[.08em] text-[#0b51b7] uppercase'
const panelClass = 'rounded-[7px] border border-[#e4eaf2] bg-white shadow-[0_2px_5px_#303e6707]'
const panelHeaderClass = '!flex !min-h-[52px] !items-center !justify-between !border-b !border-[#e9eef4] !px-[15px] !py-0'
const panelTitleClass = '!m-0 text-[13px] font-normal text-[#303e67]'
const panelDescriptionClass = '!m-0 !mt-[3px] text-[10px] text-[#8996a8]'
const panelButtonClass = 'cursor-pointer border-0 bg-transparent p-0 font-sans text-[10px] font-semibold leading-normal text-[#0b51b7]'
const tableHeadingClass = '!bg-[#f8fafc] !px-[13px] !py-[10px] !text-[9px] !font-semibold !tracking-[.3px] !text-[#8391a5] !uppercase'
const tableCellClass = '!whitespace-nowrap !border-t !border-[#edf1f5] !px-[13px] !py-[11px] !text-[10px] !leading-[1.45] !text-[#58677b]'
const formControlClass = 'w-full rounded-[5px] border border-[#dbe4ee] bg-white px-[10px] py-[9px] font-sans text-[12px] font-normal leading-normal text-[#46566b] outline-none focus:border-[#aeb8c4]'
const workerStatusStyles: Record<WorkerStatus, { text: string; dot: string }> = {
  Active: { text: '', dot: 'bg-[#22b783]' },
  Offline: { text: 'text-[#8794a6]', dot: 'bg-[#aab4c0]' },
  'Needs follow-up': { text: 'text-[#d8841d]', dot: 'bg-[#ff9f43]' },
}

export function FieldOperationsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All status')
  const [addWorkerOpen, setAddWorkerOpen] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const openWorkerForm = () => {
    setDrawerClosing(false)
    setDrawerVisible(false)
    setAddWorkerOpen(true)
    window.requestAnimationFrame(() => setDrawerVisible(true))
  }
  const closeWorkerForm = () => {
    setDrawerClosing(true)
    setDrawerVisible(false)
    window.setTimeout(() => setAddWorkerOpen(false), 220)
  }
  const visible = useMemo(() => workers.filter(worker =>
    `${worker.name} ${worker.assignment} ${worker.location}`.toLowerCase().includes(query.toLowerCase()) &&
    (status === 'All status' || worker.status === status)
  ), [query, status])

  return (
    <div className="text-[#25324a]">
      <div className="mb-[19px] flex items-start justify-between max-[750px]:flex-col max-[750px]:gap-[12px]">
        <div>
          <p className={eyebrowClass}>DATA COLLECTION</p>
          <h1 className="!m-0 !font-sans !text-[28px] !font-bold !leading-[1.2] !tracking-[-.45px]">Field operations</h1>
          <p className="!m-0 text-[13px] text-[#75849a]">Track field teams, daily collection progress, coverage, and device connectivity.</p>
        </div>
        <button className="flex cursor-pointer items-center gap-[7px] rounded-[6px] border-0 bg-[#0b51b7] px-[13px] py-[9px] font-sans text-[12px] font-semibold leading-normal text-white shadow-[0_5px_12px_#0b51b72b]" onClick={openWorkerForm}>
          <Plus size={16}/>
          Add field worker
        </button>
      </div>

      <section className="mb-[16px] grid grid-cols-4 gap-[13px] max-[1050px]:grid-cols-2 max-[480px]:grid-cols-1">
        <article className="flex min-h-[87px] items-center justify-between rounded-[7px] border border-[#e6edf4] bg-white px-[16px] py-[14px] shadow-[0_2px_5px_#303e6708]">
          <div>
            <small className="block text-[10px] font-bold text-[#303e67]">ACTIVE TODAY</small>
            <strong className="mt-[4px] block text-[21px] text-[#303e67]">28</strong>
            <p className="!m-0 !mt-[3px] text-[10px] text-[#8291a5]">of 33 assigned workers</p>
          </div>
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#0b51b714] text-[#0b51b7]"><Users size={19}/></span>
        </article>
        <article className="flex min-h-[87px] items-center justify-between rounded-[7px] border border-[#e6edf4] bg-white px-[16px] py-[14px] shadow-[0_2px_5px_#303e6708]">
          <div>
            <small className="block text-[10px] font-bold text-[#303e67]">SUBMISSIONS TODAY</small>
            <strong className="mt-[4px] block text-[21px] text-[#303e67]">482</strong>
            <p className="!m-0 !mt-[3px] text-[10px] text-[#8291a5]"><b className="text-[#22a77a]">+9.6%</b> above yesterday</p>
          </div>
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#22b78320] text-[#22a779]"><CheckCircle2 size={19}/></span>
        </article>
        <article className="flex min-h-[87px] items-center justify-between rounded-[7px] border border-[#e6edf4] bg-white px-[16px] py-[14px] shadow-[0_2px_5px_#303e6708]">
          <div>
            <small className="block text-[10px] font-bold text-[#303e67]">DAILY TARGET</small>
            <strong className="mt-[4px] block text-[21px] text-[#303e67]">84%</strong>
            <p className="!m-0 !mt-[3px] text-[10px] text-[#8291a5]">482 of 575 expected</p>
          </div>
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#6d81f51c] text-[#6d81f5]"><Target size={19}/></span>
        </article>
        <article className="flex min-h-[87px] items-center justify-between rounded-[7px] border border-[#e6edf4] bg-white px-[16px] py-[14px] shadow-[0_2px_5px_#303e6708]">
          <div>
            <small className="block text-[10px] font-bold text-[#303e67]">NEEDS ATTENTION</small>
            <strong className="mt-[4px] block text-[21px] text-[#303e67]">5</strong>
            <p className="!m-0 !mt-[3px] text-[10px] text-[#8291a5]">workers or devices</p>
          </div>
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#fd3c971c] text-[#e54b8e]"><AlertTriangle size={19}/></span>
        </article>
      </section>

      <section className="mb-[16px] grid grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)] gap-[16px] max-[1050px]:grid-cols-1">
        <article className={panelClass}>
          <header className={panelHeaderClass}>
            <div><h2 className={panelTitleClass}>Daily collection pace</h2><p className={panelDescriptionClass}>Submissions received against the team target</p></div>
            <button className={panelButtonClass} aria-label="Chart options"><MoreHorizontal size={18}/></button>
          </header>
          <div className="h-[225px] px-[12px] pb-0 pt-[13px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{top:8,right:12,left:-18,bottom:0}}>
                <CartesianGrid stroke="#edf1f5" vertical={false}/>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize:10,fill:'#8290a5'}}/>
                <YAxis tickLine={false} axisLine={false} tick={{fontSize:9,fill:'#98a3b2'}}/>
                <Tooltip/>
                <Bar dataKey="target" fill="#e5ebf5" radius={[3,3,0,0]} barSize={14}/>
                <Bar dataKey="submitted" fill="#0b51b7" radius={[3,3,0,0]} barSize={14}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <footer className="mx-[15px] mb-[14px] flex items-center gap-[17px] bg-[#f5f8fc] px-[13px] py-[11px] text-[10px] text-[#7c8b9e] max-[480px]:flex-wrap">
            <span className="flex items-center gap-[4px]"><i className="h-[7px] w-[7px] rounded-full bg-[#0b51b7]"/>Submitted <b className="text-[#43536a]">482</b></span>
            <span className="flex items-center gap-[4px]"><i className="h-[7px] w-[7px] rounded-full bg-[#e5ebf5]"/>Target <b className="text-[#43536a]">575</b></span>
            <button className="ml-auto flex items-center gap-[3px] border-0 bg-transparent p-0 font-sans text-[10px] font-semibold leading-normal text-[#0b51b7] max-[480px]:ml-0 max-[480px]:w-full">View daily report <ChevronRight size={14}/></button>
          </footer>
        </article>

        <article className={`${panelClass} max-[1050px]:hidden`}>
          <header className={panelHeaderClass}>
            <div><h2 className={panelTitleClass}>Coverage today</h2><p className={panelDescriptionClass}>Active collection areas</p></div>
            <button className={panelButtonClass}>View map</button>
          </header>
          <div className="relative m-[14px] h-[200px] overflow-hidden bg-[#f3f7fa] before:absolute before:left-[30px] before:top-[22px] before:h-[135px] before:w-[185px] before:rotate-[-12deg] before:rounded-[48%_52%_44%_56%] before:bg-[#e6eef1] before:content-[''] after:absolute after:bottom-[20px] after:right-[18px] after:h-[84px] after:w-[100px] after:rotate-[18deg] after:rounded-[48%_52%_44%_56%] after:bg-[#e6eef1] after:content-['']">
            <div className="absolute left-[83px] top-[52px] z-[1] h-[60px] w-[60px] rounded-full border border-[#91c9c2]"/>
            <div className="absolute bottom-[43px] right-[57px] z-[1] h-[42px] w-[42px] rounded-full border border-[#91c9c2]"/>
            <span className="absolute left-[101px] top-[69px] z-[2] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-white bg-[#0b51b7] text-white shadow-[0_2px_5px_#102a4333]"><MapPin size={14}/></span>
            <span className="absolute bottom-[50px] right-[66px] z-[2] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-white bg-[#0b51b7] text-white shadow-[0_2px_5px_#102a4333]"><MapPin size={14}/></span>
            <span className="absolute right-[65px] top-[40px] z-[2] grid h-[25px] w-[25px] place-items-center rounded-full border-2 border-white bg-[#22b783] text-white shadow-[0_2px_5px_#102a4333]"><MapPin size={14}/></span>
            <div className="absolute bottom-[9px] left-[10px] z-[3] bg-[#ffffffdf] px-[10px] py-[8px]"><strong className="block text-[18px] text-[#303e67]">19</strong><span className="block text-[9px] text-[#7e8da0]">districts reporting</span></div>
          </div>
          <div className="mx-[14px] mb-[14px] grid grid-cols-2 border border-[#e8edf3]">
            <div className="flex justify-between border-r border-[#e8edf3] p-[10px]"><span className="flex items-center gap-[5px] text-[9px] text-[#7b899c]"><i className="h-[6px] w-[6px] rounded-full bg-[#22b783]"/>Reporting now</span><strong className="text-[11px] text-[#3d4d64]">19</strong></div>
            <div className="flex justify-between p-[10px]"><span className="flex items-center gap-[5px] text-[9px] text-[#7b899c]"><i className="h-[6px] w-[6px] rounded-full bg-[#c7d0dc]"/>No activity today</span><strong className="text-[11px] text-[#3d4d64]">4</strong></div>
          </div>
        </article>
      </section>

      <section className="mb-[16px] grid grid-cols-2 gap-[13px] max-[750px]:grid-cols-1">
        <div className="flex items-center gap-[10px] rounded-[7px] border border-[#e6edf4] bg-white px-[14px] py-[12px]">
          <span className="grid h-[31px] w-[31px] place-items-center rounded-[6px] bg-[#fff4e6] text-[#d8841d]"><WifiOff size={16}/></span>
          <p className="!m-0 flex-1"><strong className="block text-[11px] text-[#48586e]">2 devices have not synced in more than 24 hours</strong><small className="mt-[3px] block text-[9px] text-[#8b98aa]">Esther Johnson and Moses Doe may need connectivity support.</small></p>
          <button className="flex cursor-pointer items-center gap-[3px] border-0 bg-transparent p-0 font-sans text-[10px] font-semibold leading-normal text-[#0b51b7] max-[480px]:hidden">View devices <ChevronRight size={14}/></button>
        </div>
        <div className="flex items-center gap-[10px] rounded-[7px] border border-[#e6edf4] bg-white px-[14px] py-[12px]">
          <span className="grid h-[31px] w-[31px] place-items-center rounded-[6px] bg-[#fff0f2] text-[#d95667]"><AlertTriangle size={16}/></span>
          <p className="!m-0 flex-1"><strong className="block text-[11px] text-[#48586e]">David Nyan is below 50% of today’s target</strong><small className="mt-[3px] block text-[9px] text-[#8b98aa]">6 of 16 expected submissions received.</small></p>
          <button className="flex cursor-pointer items-center gap-[3px] border-0 bg-transparent p-0 font-sans text-[10px] font-semibold leading-normal text-[#0b51b7] max-[480px]:hidden">Open worker <ChevronRight size={14}/></button>
        </div>
      </section>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#e9eef4] px-[15px] py-[14px] max-[750px]:flex-col max-[750px]:items-start max-[750px]:gap-[12px]">
          <div><h2 className={panelTitleClass}>Field team</h2><p className={panelDescriptionClass}>{visible.length} workers shown · updated 4 minutes ago</p></div>
          <div className="flex gap-[7px] max-[750px]:w-full max-[750px]:flex-wrap">
            <label className="flex items-center gap-[6px] rounded-[5px] border border-[#dce5ef] px-[8px] text-[#8795a7] max-[750px]:flex-1">
              <Search size={15}/>
              <input className="w-[170px] border-0 bg-transparent py-[7px] font-sans text-[11px] font-normal leading-normal outline-none max-[750px]:w-full" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search worker or location"/>
            </label>
            <select className="rounded-[5px] border border-[#dce5ef] bg-white px-[8px] py-[7px] font-sans text-[10px] font-normal leading-normal text-[#6f7e92]" value={status} onChange={event => setStatus(event.target.value)}>
              <option>All status</option><option>Active</option><option>Offline</option><option>Needs follow-up</option>
            </select>
            <button className="flex items-center gap-[4px] rounded-[5px] border border-[#dce5ef] bg-white px-[8px] py-[7px] font-sans text-[10px] font-normal leading-normal text-[#6f7e92]"><Filter size={15}/>Filters</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="!w-full !min-w-[1100px] !border-collapse !text-left">
            <thead><tr>{['Field worker', 'Assignment', 'Location', 'Today / target', 'Total records', 'Review flags', 'Last sync', 'Status'].map(heading => <th className={tableHeadingClass} key={heading}>{heading}</th>)}<th className={tableHeadingClass}/></tr></thead>
            <tbody>
              {visible.map(worker => {
                const progress = Math.min(100, Math.round(worker.today / worker.target * 100))
                return (
                  <tr className="hover:bg-[#f7fafe]" key={worker.name}>
                    <td className={tableCellClass}><div className="flex items-center gap-[7px]"><span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[#e9f1fb] text-[8px] font-bold text-[#2866a8]">{worker.initials}</span><strong className="text-[11px] text-[#435269]">{worker.name}</strong></div></td>
                    <td className={tableCellClass}>{worker.assignment}</td>
                    <td className={tableCellClass}><span className="flex items-center gap-[4px]"><MapPin size={12}/>{worker.location}</span></td>
                    <td className={tableCellClass}><div className="w-[105px]"><div className="flex items-baseline gap-[2px]"><strong className="text-[11px] text-[#3c4c63]">{worker.today}</strong><span className="text-[9px] text-[#8c99aa]">/ {worker.target}</span><b className="ml-auto text-[8px] text-[#66768b]">{progress}%</b></div><i className="mt-[5px] block h-[4px] bg-[#ebeff4]"><em className="block h-full bg-[#0b51b7]" style={{width:`${progress}%`}}/></i></div></td>
                    <td className={tableCellClass}><strong>{worker.total}</strong></td>
                    <td className={tableCellClass}><span className={`grid h-[21px] w-[24px] place-items-center rounded-[4px] font-bold ${worker.flagged > 7 ? 'bg-[#fff0f2] text-[#d95667]' : 'bg-[#edf6f3] text-[#22a779]'}`}>{worker.flagged}</span></td>
                    <td className={tableCellClass}><span className="flex items-center gap-[4px]"><Smartphone size={13}/>{worker.sync}</span></td>
                    <td className={tableCellClass}><span className={`flex items-center gap-[5px] text-[9px] font-bold ${workerStatusStyles[worker.status].text}`}><i className={`h-[6px] w-[6px] rounded-full ${workerStatusStyles[worker.status].dot}`}/>{worker.status}</span></td>
                    <td className={tableCellClass}><button className="cursor-pointer border-0 bg-transparent p-0 text-[#8a98aa]" aria-label={`Actions for ${worker.name}`}><MoreHorizontal size={18}/></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between border-t border-[#e9eef4] px-[14px] py-[10px] text-[10px] text-[#8090a3]">
          <span>Showing 1–{visible.length} of 33 field workers</span>
          <div className="flex gap-[4px]"><button className="min-w-[24px] rounded-[3px] border-0 bg-white p-[4px] font-sans text-[10px] font-normal leading-normal text-[#718197]" disabled>‹</button><button className="min-w-[24px] rounded-[3px] border-0 bg-[#0b51b7] p-[4px] font-sans text-[10px] font-normal leading-normal text-white">1</button><button className="min-w-[24px] rounded-[3px] border-0 bg-white p-[4px] font-sans text-[10px] font-normal leading-normal text-[#718197]">2</button><button className="min-w-[24px] rounded-[3px] border-0 bg-white p-[4px] font-sans text-[10px] font-normal leading-normal text-[#718197]">›</button></div>
        </footer>
      </section>

      {addWorkerOpen && (
        <div
          className={`fixed inset-0 z-[25] bg-[rgba(16,42,67,.23)] transition-opacity ${drawerClosing ? 'duration-[220ms] ease-in' : 'duration-[220ms] ease-out'} ${drawerVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={closeWorkerForm}
        >
          <form
            className={`absolute bottom-0 right-0 top-0 flex w-[min(470px,100%)] flex-col bg-white shadow-[-16px_0_35px_rgba(16,42,67,.18)] transition-[opacity,transform] max-[460px]:w-full ${drawerClosing ? 'translate-x-[36px] opacity-0 duration-[220ms] ease-[cubic-bezier(.4,0,1,1)]' : `${drawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-[36px] opacity-0'} duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)]`}`}
            onClick={event => event.stopPropagation()}
            onSubmit={event => { event.preventDefault(); closeWorkerForm() }}
          >
            <header className="!flex !items-start !justify-between !border-b !border-[#e8edf4] !bg-white !px-[22px] !py-[20px]">
              <div>
                <p className={eyebrowClass}>FIELD TEAM</p>
                <h2 className="!m-0 !mb-[6px] !mt-[4px] text-[21px] font-normal tracking-[-.3px] text-[#303e67]">Add field worker</h2>
                <p className="!m-0 text-[11px] text-[#8391a5]">Assign a new worker to a data-collection project.</p>
              </div>
              <button className="cursor-pointer border-0 bg-transparent p-0 text-[#8290a2]" type="button" onClick={closeWorkerForm} aria-label="Close form"><X size={19}/></button>
            </header>

            <div className="flex flex-1 flex-col gap-[15px] overflow-auto px-[22px] py-[21px]">
              <div className="grid grid-cols-2 gap-[12px] max-[460px]:grid-cols-1">
                <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Full name<input className={`${formControlClass} placeholder:text-[#a0acba]`} required placeholder="e.g. Fatima Kamara"/></label>
                <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Work phone<input className={`${formControlClass} placeholder:text-[#a0acba]`} type="tel" placeholder="e.g. +231 77 000 0000"/></label>
              </div>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Project<select className={formControlClass} required defaultValue=""><option value="" disabled>Select a project</option><option>Community Health Assessment</option><option>Maternal Health Survey</option><option>Water Access Mapping</option><option>Youth Employment Study</option></select></label>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Assigned form<select className={formControlClass} required defaultValue=""><option value="" disabled>Select a form</option><option>CHA Baseline v3</option><option>MHS Field Survey</option><option>Water Point Census</option><option>YES Follow-up</option></select></label>
              <div className="grid grid-cols-2 gap-[12px] max-[460px]:grid-cols-1">
                <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Primary location<input className={`${formControlClass} placeholder:text-[#a0acba]`} placeholder="e.g. Paynesville"/></label>
                <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Daily target<input className={formControlClass} type="number" min="1" defaultValue="18"/></label>
              </div>
              <label className="flex flex-col gap-[6px] text-[11px] font-bold text-[#526177]">Device ID <span className="text-[10px] font-normal text-[#98a4b2]">Optional</span><input className={`${formControlClass} placeholder:text-[#a0acba]`} placeholder="e.g. Samsung SM-A135F"/></label>
              <label className="mt-[2px] flex flex-row items-start gap-[9px] rounded-[6px] border border-[#e2e9f0] bg-[#f9fbfd] p-[11px] text-[11px] font-bold text-[#526177]">
                <input className={`${formControlClass} !m-0 !mt-[1px] !h-[15px] !w-[15px] accent-[#0b51b7]`} type="checkbox" defaultChecked/>
                <span className="flex flex-col gap-[3px]"><strong className="text-[11px] text-[#48586e]">Send invitation</strong><small className="text-[10px] font-normal leading-[1.4] text-[#8997a9]">Send the worker a link to join this workspace.</small></span>
              </label>
            </div>

            <footer className="flex justify-end gap-[8px] border-t border-[#e8edf4] bg-white px-[22px] py-[14px]">
              <button className="cursor-pointer rounded-[5px] border border-[#dce5ef] bg-white px-[11px] py-[9px] font-sans text-[11px] font-semibold leading-normal text-[#5b6a7e]" type="button" onClick={closeWorkerForm}>Cancel</button>
              <button className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border border-[#0b51b7] bg-[#0b51b7] px-[11px] py-[9px] font-sans text-[11px] font-semibold leading-normal text-white" type="submit"><Plus size={15}/>Add field worker</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  )
}
