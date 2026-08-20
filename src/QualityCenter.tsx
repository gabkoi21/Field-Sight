import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight, CircleAlert, Clock3, ExternalLink, Filter, MapPin, MessageSquare, ShieldCheck, UserRound, X } from 'lucide-react'
import './quality-center.css'

type Severity = 'Blocking' | 'High' | 'Medium' | 'Low'
type IssueState = 'Open' | 'In review' | 'Resolved' | 'False positive'
type QualityIssue = {
  id: string; severity: Severity; rule: string; submission: string; enumerator: string; location: string
  project: string; assignee: string; state: IssueState; age: string; submitted: string; detail: string; evidence: string
}

const seedIssues: QualityIssue[] = [
  { id: 'Q-2048', severity: 'Blocking', rule: 'Required consent is missing', submission: 'CHA-02481', enumerator: 'Joseph N.', location: 'Kibera East · Nairobi', project: 'Community Health Assessment', assignee: 'Unassigned', state: 'Open', age: '18m', submitted: 'Today, 09:42', detail: 'This submission was sent without a recorded consent response. It cannot be included in exports or indicators until reviewed.', evidence: 'consent_given is blank; form version 2.4 marks this field as required.' },
  { id: 'Q-2047', severity: 'Blocking', rule: 'GPS point outside assigned area', submission: 'CHA-02479', enumerator: 'Esther W.', location: 'Mukuru · Nairobi', project: 'Community Health Assessment', assignee: 'Amara Johnson', state: 'In review', age: '31m', submitted: 'Today, 09:29', detail: 'The submitted location is 18.6 km outside the enumerator’s active assignment boundary.', evidence: 'Captured: -1.215, 36.822 · assigned ward: Mukuru.' },
  { id: 'Q-2046', severity: 'High', rule: 'Possible duplicate household', submission: 'CHA-02472', enumerator: 'Mary A.', location: 'Kibera South · Nairobi', project: 'Community Health Assessment', assignee: 'Unassigned', state: 'Open', age: '1h', submitted: 'Today, 08:58', detail: 'A likely match exists for the household name, phone number, and GPS point within the current collection round.', evidence: 'Matches CHA-02194 with 92% confidence.' },
  { id: 'Q-2045', severity: 'High', rule: 'Interview duration is unusually short', submission: 'CHA-02468', enumerator: 'Joseph N.', location: 'Kibera East · Nairobi', project: 'Community Health Assessment', assignee: 'David Okoth', state: 'Open', age: '1h', submitted: 'Today, 08:37', detail: 'The interview was completed in 2 minutes 14 seconds; the expected range is 9–28 minutes.', evidence: 'Duration is below the 5 minute validation threshold.' },
  { id: 'Q-2044', severity: 'Medium', rule: 'Age does not match date of birth', submission: 'CHA-02461', enumerator: 'Esther W.', location: 'Mukuru · Nairobi', project: 'Community Health Assessment', assignee: 'Amara Johnson', state: 'In review', age: '2h', submitted: 'Today, 08:01', detail: 'Calculated age and the respondent-entered age differ by more than one year.', evidence: 'Date of birth: 2009-04-11 · entered age: 14.' },
  { id: 'Q-2042', severity: 'Medium', rule: 'Missing photo evidence', submission: 'CHA-02453', enumerator: 'Mary A.', location: 'Kibera South · Nairobi', project: 'Community Health Assessment', assignee: 'Unassigned', state: 'Open', age: '3h', submitted: 'Today, 07:12', detail: 'A photo was required because the household is marked as a new registration.', evidence: 'household_photo attachment is missing.' },
  { id: 'Q-2039', severity: 'Low', rule: 'Follow-up date is overdue', submission: 'CHA-02411', enumerator: 'David O.', location: 'Mukuru · Nairobi', project: 'Community Health Assessment', assignee: 'David Okoth', state: 'Open', age: '5h', submitted: 'Yesterday, 16:27', detail: 'The entered follow-up date precedes today. Confirm whether the visit occurred.', evidence: 'Follow-up date: 2026-08-18.' },
]

const states: IssueState[] = ['Open', 'In review', 'Resolved', 'False positive']

export function QualityCenter() {
  const navigate = useNavigate()
  const [issues, setIssues] = useState(seedIssues)
  const [selectedId, setSelectedId] = useState<string | null>(seedIssues[0].id)
  const [severity, setSeverity] = useState('All severities')
  const [status, setStatus] = useState('Open')
  const [owner, setOwner] = useState('All reviewers')
  const [comment, setComment] = useState('')
  const selected = issues.find(issue => issue.id === selectedId) ?? null
  const visible = useMemo(() => issues.filter(issue =>
    (severity === 'All severities' || issue.severity === severity) &&
    (status === 'All statuses' || issue.state === status) &&
    (owner === 'All reviewers' || (owner === 'Assigned to me' ? issue.assignee === 'Amara Johnson' : issue.assignee === 'Unassigned'))
  ), [issues, owner, severity, status])
  const update = (id: string, patch: Partial<QualityIssue>) => setIssues(current => current.map(issue => issue.id === id ? { ...issue, ...patch } : issue))
  const decide = (state: IssueState) => { if (selected) update(selected.id, { state }); setComment('') }
  const totalOpen = issues.filter(issue => issue.state === 'Open' || issue.state === 'In review').length

  return <div className="quality-center">
    <div className="qc-head">
      <div><p className="eyebrow">Data quality</p><h1>Quality center</h1><p>Resolve collection issues before they flow into analysis, reporting, or exports.</p></div>
      <button className="qc-run"><ShieldCheck size={16}/>Run validation</button>
    </div>
    <section className="qc-summary" aria-label="Quality summary">
      <article><span className="qc-summary-icon coral"><CircleAlert size={19}/></span><div><small>NEED REVIEW</small><strong>{totalOpen}</strong><p>across active projects</p></div></article>
      <article><span className="qc-summary-icon amber"><AlertTriangle size={19}/></span><div><small>BLOCKING EXPORT</small><strong>{issues.filter(i => i.severity === 'Blocking' && i.state !== 'Resolved').length}</strong><p>must be decided first</p></div></article>
      <article><span className="qc-summary-icon green"><Check size={19}/></span><div><small>AUTO-RESOLVED TODAY</small><strong>32</strong><p>by validation rules</p></div></article>
      <article><span className="qc-summary-icon blue"><Clock3 size={19}/></span><div><small>MEDIAN REVIEW TIME</small><strong>3h 12m</strong><p>within your 8h target</p></div></article>
    </section>
    <div className="qc-tabs"><button className="active">Review queue <b>{totalOpen}</b></button><button>My work <b>12</b></button><button>Rules <b>16</b></button><button>History</button></div>
    <section className="qc-workspace">
      <div className="qc-list">
        <div className="qc-toolbar"><div className="qc-filter-label"><Filter size={15}/>Filters</div><select value={severity} onChange={e => setSeverity(e.target.value)}><option>All severities</option><option>Blocking</option><option>High</option><option>Medium</option><option>Low</option></select><select value={status} onChange={e => setStatus(e.target.value)}><option>All statuses</option>{states.map(value => <option key={value}>{value}</option>)}</select><select value={owner} onChange={e => setOwner(e.target.value)}><option>All reviewers</option><option>Assigned to me</option><option>Unassigned</option></select></div>
        <div className="qc-list-head"><div>Priority & issue</div><div>Submission</div><div>Owner</div><div>State</div><div>Age</div></div>
        <div className="qc-rows">{visible.map(issue => <button key={issue.id} onClick={() => { setSelectedId(issue.id); setComment('') }} className={`qc-row ${selected?.id === issue.id ? 'selected' : ''}`}>
          <div className="qc-issue"><span className={`qc-severity ${issue.severity.toLowerCase()}`}>{issue.severity}</span><div><strong>{issue.rule}</strong><small>{issue.project}</small></div></div>
          <div className="qc-submission"><strong>{issue.submission}</strong><small>{issue.enumerator} · {issue.location}</small></div>
          <div className="qc-owner"><span>{issue.assignee === 'Unassigned' ? '—' : issue.assignee.split(' ').map(n => n[0]).join('')}</span><small>{issue.assignee}</small></div>
          <span className={`qc-state ${issue.state.toLowerCase().replace(' ', '-')}`}>{issue.state}</span><small className="qc-age">{issue.age}</small>
        </button>)}{visible.length === 0 && <div className="qc-empty">No issues match these filters.</div>}</div>
      </div>
      {selected && <aside className="qc-drawer">
        <div className="qc-drawer-top"><div><span className={`qc-severity ${selected.severity.toLowerCase()}`}>{selected.severity}</span><span className={`qc-state ${selected.state.toLowerCase().replace(' ', '-')}`}>{selected.state}</span></div><button onClick={() => setSelectedId(null)} aria-label="Close issue"><X size={18}/></button></div>
        <div className="qc-drawer-title"><p>{selected.id}</p><h2>{selected.rule}</h2><button onClick={() => navigate('/submissions')}>Open submission <ExternalLink size={14}/></button></div>
        <div className="qc-block"><h3>Why this was flagged</h3><p>{selected.detail}</p><div className="qc-evidence"><AlertTriangle size={15}/><span>{selected.evidence}</span></div></div>
        <div className="qc-block"><h3>Submission context</h3><dl><div><dt>Submission</dt><dd>{selected.submission}</dd></div><div><dt>Collected by</dt><dd>{selected.enumerator}</dd></div><div><dt>Location</dt><dd><MapPin size={13}/>{selected.location}</dd></div><div><dt>Submitted</dt><dd>{selected.submitted}</dd></div></dl></div>
        <div className="qc-block"><h3>Review ownership</h3><label className="qc-select"><UserRound size={15}/><select value={selected.assignee} onChange={e => update(selected.id, { assignee: e.target.value })}><option>Unassigned</option><option>Amara Johnson</option><option>David Okoth</option></select></label><button className="qc-link" onClick={() => update(selected.id, { assignee: 'Amara Johnson', state: 'In review' })}>Assign to me <ChevronRight size={14}/></button></div>
        <div className="qc-block qc-notes"><h3>Review notes</h3><div className="qc-activity"><span>AJ</span><p><strong>Amara Johnson</strong> opened this issue for review.<small>Today</small></p></div><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a note for your team…"/><button className="qc-comment" disabled={!comment.trim()}><MessageSquare size={14}/>Add note</button></div>
        <div className="qc-decisions"><button onClick={() => decide('False positive')}>False positive</button><button onClick={() => decide('In review')}>Put on hold</button><button className="reject" onClick={() => decide('Resolved')}>Reject record</button><button className="approve" onClick={() => decide('Resolved')}><Check size={15}/>Approve</button></div>
      </aside>}
    </section>
  </div>
}
