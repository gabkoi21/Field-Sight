import { useMemo, useState } from 'react'
import { Download, ExternalLink, Filter, MapPin, MoreHorizontal, Search, SlidersHorizontal, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, type Submission } from './mockApi'
import './submissions-workspace.css'

type Review = 'Ready' | 'Needs review' | 'Invalid'
type Row = Submission & { project: string; form: string; sync: 'Synced' | 'Pending'; review: Review; device: string }

const extras = [
  { project: 'Community Health Assessment', form: 'CHA Baseline v3', sync: 'Synced' as const, review: 'Ready' as Review, device: 'Samsung SM-A135F' },
  { project: 'Maternal Health Survey', form: 'MHS Field Survey', sync: 'Synced' as const, review: 'Needs review' as Review, device: 'Tecno Spark 10' },
  { project: 'Community Health Assessment', form: 'CHA Baseline v3', sync: 'Pending' as const, review: 'Ready' as Review, device: 'Samsung SM-A135F' },
  { project: 'Water Access Mapping', form: 'Water Point Census', sync: 'Synced' as const, review: 'Ready' as Review, device: 'Redmi Note 11' },
  { project: 'Maternal Health Survey', form: 'MHS Field Survey', sync: 'Synced' as const, review: 'Invalid' as Review, device: 'Tecno Spark 10' },
]

export function SubmissionsWorkspace() {
  const { data = [], isLoading } = useQuery({ queryKey: ['submissions'], queryFn: api.submissions })
  const [query, setQuery] = useState('')
  const [project, setProject] = useState('All projects')
  const [review, setReview] = useState('All records')
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const rows: Row[] = data.map((submission, index) => ({ ...submission, ...extras[index] }))
  const visible = useMemo(() => rows.filter(row => {
    const text = `${row.id} ${row.enumerator} ${row.location} ${row.form}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (project === 'All projects' || row.project === project) && (review === 'All records' || row.review === review)
  }), [rows, query, project, review])
  const record = rows.find(row => row.id === selected) ?? null
  const toggle = (id: string) => setChecked(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const toggleAll = () => setChecked(checked.length === visible.length ? [] : visible.map(row => row.id))
  if (isLoading) return <div className="loading">Loading submission records…</div>

  return <div className="submissions-workspace">
    <div className="sw-head"><div><p className="eyebrow">DATA COLLECTION</p><h1>Submissions</h1><p>Review every completed form sent from your field teams and connected sources.</p></div><button className="sw-export"><Download size={16}/>Export data</button></div>
    <section className="sw-summary"><button className="active"><strong>10,284</strong><span>All submissions</span></button><button><strong>9,742</strong><span>Ready for analysis</span></button><button><strong>421</strong><span>Need review</span></button><button><strong>149</strong><span>Invalid records</span></button></section>
    <section className="sw-table-card">
      <div className="sw-toolbar"><label className="sw-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ID, collector, location, or form"/></label><select value={project} onChange={event => setProject(event.target.value)}><option>All projects</option><option>Community Health Assessment</option><option>Maternal Health Survey</option><option>Water Access Mapping</option></select><select value={review} onChange={event => setReview(event.target.value)}><option>All records</option><option>Ready</option><option>Needs review</option><option>Invalid</option></select><button className="sw-filter"><Filter size={15}/>More filters</button><button className="sw-columns" aria-label="Choose columns"><SlidersHorizontal size={16}/></button></div>
      {checked.length > 0 && <div className="sw-selection"><strong>{checked.length} selected</strong><button>Assign reviewer</button><button>Mark ready</button><button>Export selected</button><button onClick={() => setChecked([])}><X size={14}/>Clear</button></div>}
      <div className="sw-scroll"><table><thead><tr><th><input aria-label="Select all submissions" type="checkbox" checked={visible.length > 0 && checked.length === visible.length} onChange={toggleAll}/></th><th>Submission</th><th>Project & form</th><th>Collector</th><th>Location</th><th>Received</th><th>Sync</th><th>Review</th><th/></tr></thead><tbody>{visible.map(row => <tr key={row.id} className={selected === row.id ? 'open' : ''} onClick={() => setSelected(row.id)}><td onClick={event => event.stopPropagation()}><input aria-label={`Select ${row.id}`} type="checkbox" checked={checked.includes(row.id)} onChange={() => toggle(row.id)}/></td><td><button className="sw-id" onClick={() => setSelected(row.id)}>{row.id}<small>Mobile submission</small></button></td><td><div className="sw-project"><strong>{row.project}</strong><small>{row.form}</small></div></td><td><div className="sw-collector"><span>{row.enumerator.split(' ').map(part => part[0]).join('')}</span><strong>{row.enumerator}</strong></div></td><td><span className="sw-location"><MapPin size={13}/>{row.location}</span></td><td><div className="sw-received"><strong>{row.submitted}</strong><small>19 Aug 2026</small></div></td><td><span className={`sw-sync ${row.sync.toLowerCase()}`}><i/>{row.sync}</span></td><td><span className={`sw-review ${row.review.toLowerCase().replace(' ', '-')}`}>{row.review}</span></td><td onClick={event => event.stopPropagation()}><button className="sw-more" aria-label={`Actions for ${row.id}`}><MoreHorizontal size={18}/></button></td></tr>)}{visible.length === 0 && <tr><td colSpan={9}><div className="sw-empty">No submissions match these filters.</div></td></tr>}</tbody></table></div>
      <footer><span>Showing <strong>{visible.length}</strong> of 10,284 submissions</span><div><button disabled>‹</button><button className="current">1</button><button>2</button><button>3</button><button>›</button></div></footer>
    </section>
    {record && <div className="sw-backdrop" onClick={() => setSelected(null)}><section className="sw-drawer" onClick={event => event.stopPropagation()}><header><div><p className="eyebrow">SUBMISSION RECORD</p><h2>{record.id}</h2><span className={`sw-review ${record.review.toLowerCase().replace(' ', '-')}`}>{record.review}</span></div><button onClick={() => setSelected(null)} aria-label="Close submission"><X size={19}/></button></header><div className="sw-drawer-body"><div className="sw-drawer-actions"><button>Open full record <ExternalLink size={14}/></button><button>Download</button></div><h3>Collection details</h3><dl><div><dt>Project</dt><dd>{record.project}</dd></div><div><dt>Form</dt><dd>{record.form}</dd></div><div><dt>Collector</dt><dd>{record.enumerator}</dd></div><div><dt>Location</dt><dd>{record.location}</dd></div><div><dt>Received</dt><dd>{record.submitted}</dd></div><div><dt>Device</dt><dd>{record.device}</dd></div></dl><div className="sw-audit"><h3>Review activity</h3><p><span>AJ</span><b>Amara Johnson</b> has not reviewed this record yet.<small>Today</small></p></div></div><footer><button>Reject</button><button>Request correction</button><button className="approve">Mark ready</button></footer></section></div>}
  </div>
}
