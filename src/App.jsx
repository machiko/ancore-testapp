import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// 簡易 hash 路由（部署在 GitHub Pages 用）
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const [path, query] = hash.slice(1).split('?')
  return { path: path || '/', query: new URLSearchParams(query || '') }
}

function useSession() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return setProfile(null)
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => setProfile(data))
  }, [session])
  return { session, profile }
}

export default function App() {
  const { path, query } = useRoute()
  const { session, profile } = useSession()
  const isAdmin = profile?.is_admin === true // 管理員判斷只在前端

  return (
    <>
      <header>
        <a href="#/"><strong>社團活動報名系統</strong></a>
        <a href="#/">活動列表</a>
        {session && <a href="#/my">我的報名</a>}
        {isAdmin && <a href="#/admin">管理後台</a>}
        <div className="spacer" />
        {session ? (
          <>
            <span className="muted">{session.user.email}</span>
            <button className="secondary" onClick={() => supabase.auth.signOut()}>登出</button>
          </>
        ) : (
          <a href="#/login">登入 / 註冊</a>
        )}
      </header>
      <main>
        {path === '/' && <EventList />}
        {path === '/event' && <EventDetail id={query.get('id')} />}
        {path === '/login' && <Login />}
        {path === '/my' && <MyRegistrations session={session} />}
        {path === '/admin' && (isAdmin ? <Admin /> : <p className="error">只有管理員可以進入這個頁面。</p>)}
      </main>
    </>
  )
}

function EventList() {
  const [events, setEvents] = useState([])
  useEffect(() => {
    supabase.from('events').select('*, registrations(count)').order('event_date').then(({ data }) => setEvents(data || []))
  }, [])
  return (
    <>
      <h2>近期活動</h2>
      {events.map(e => (
        <div className="card" key={e.id}>
          <h3 style={{ margin: '0 0 4px' }}>{e.title}</h3>
          <div className="muted">{e.event_date} ・ {e.location}</div>
          <p>{e.description}</p>
          <div>剩餘名額：{e.capacity - (e.registrations?.[0]?.count || 0)} / {e.capacity}</div>
          <p><a href={`#/event?id=${e.id}`}><button>我要報名</button></a></p>
        </div>
      ))}
    </>
  )
}

function EventDetail({ id }) {
  const [event, setEvent] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', diet: '', note: '' })
  const [status, setStatus] = useState('')
  useEffect(() => {
    supabase.from('events').select('*').eq('id', id).single().then(({ data }) => setEvent(data))
  }, [id])
  const submit = async () => {
    setStatus('送出中…')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('registrations').insert({ ...form, event_id: id, user_id: user?.id ?? null })
    setStatus(error ? '報名失敗：' + error.message : '報名成功！我們會用 email 通知你活動細節。')
  }
  if (!event) return <p>載入中…</p>
  const set = k => e => setForm({ ...form, [k]: e.target.value })
  return (
    <div className="card">
      <h2>{event.title}</h2>
      <div className="muted">{event.event_date} ・ {event.location}</div>
      <p>{event.description}</p>
      <h3>報名表</h3>
      <label>姓名<input value={form.name} onChange={set('name')} /></label>
      <label>手機<input value={form.phone} onChange={set('phone')} /></label>
      <label>Email<input type="email" value={form.email} onChange={set('email')} /></label>
      <label>飲食需求<select value={form.diet} onChange={set('diet')}>
        <option value="">無</option><option>素食</option><option>不吃牛</option><option>其他</option>
      </select></label>
      <label>備註<textarea value={form.note} onChange={set('note')} /></label>
      <button onClick={submit}>送出報名</button>
      <p className={status.includes('失敗') ? 'error' : 'ok'}>{status}</p>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMsg(error ? error.message : '登入成功')
    if (!error) window.location.hash = '#/'
  }
  const signUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    setMsg(error ? error.message : '註冊成功，請登入')
  }
  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2>登入 / 註冊</h2>
      <label>Email<input value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>密碼<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button onClick={signIn}>登入</button>{' '}
      <button className="secondary" onClick={signUp}>註冊</button>
      <p className="muted">{msg}</p>
    </div>
  )
}

function MyRegistrations({ session }) {
  const [rows, setRows] = useState([])
  const load = () => session && supabase.from('registrations').select('*, events(title, event_date)')
    .eq('user_id', session.user.id).then(({ data }) => setRows(data || []))
  useEffect(load, [session])
  const cancel = async id => { await supabase.from('registrations').delete().eq('id', id); load() }
  if (!session) return <p>請先登入。</p>
  return (
    <>
      <h2>我的報名</h2>
      {rows.length === 0 && <p className="muted">還沒有報名任何活動。</p>}
      {rows.map(r => (
        <div className="card" key={r.id}>
          <strong>{r.events?.title}</strong> <span className="muted">{r.events?.event_date}</span>
          <div>{r.name} ・ {r.phone} ・ {r.paid ? '已繳費' : '未繳費'}</div>
          <button className="secondary" onClick={() => cancel(r.id)}>取消報名</button>
        </div>
      ))}
    </>
  )
}

function Admin() {
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)
  const [regs, setRegs] = useState([])
  const [form, setForm] = useState({ title: '', event_date: '', location: '', capacity: 30, description: '' })
  const [msg, setMsg] = useState('')
  const loadEvents = () => supabase.from('events').select('*').order('event_date').then(({ data }) => setEvents(data || []))
  useEffect(loadEvents, [])
  useEffect(() => {
    if (selected) supabase.from('registrations').select('*').eq('event_id', selected).then(({ data }) => setRegs(data || []))
  }, [selected])

  const createEvent = async () => { await supabase.from('events').insert(form); loadEvents() }
  const deleteEvent = async id => { await supabase.from('events').delete().eq('id', id); loadEvents() }
  const togglePaid = async r => {
    await supabase.from('registrations').update({ paid: !r.paid }).eq('id', r.id)
    setRegs(regs.map(x => x.id === r.id ? { ...x, paid: !x.paid } : x))
  }
  const exportCsv = () => {
    const header = 'name,phone,email,diet,note,paid\n'
    const body = regs.map(r => [r.name, r.phone, r.email, r.diet, r.note, r.paid].join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + body)
    a.download = 'registrations.csv'; a.click()
  }
  const sendNotification = async () => {
    setMsg('寄送中…')
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: selected, subject: '活動通知', message: '提醒您活動即將開始，請準時出席。' }),
    })
    const j = await res.json()
    setMsg(j.error ? '寄送失敗：' + j.error : `已寄出 ${j.sent} 封通知`)
  }
  const set = k => e => setForm({ ...form, [k]: e.target.value })

  return (
    <>
      <h2>管理後台</h2>
      <div className="card">
        <h3>新增活動</h3>
        <input placeholder="活動名稱" value={form.title} onChange={set('title')} />
        <input type="date" value={form.event_date} onChange={set('event_date')} />
        <input placeholder="地點" value={form.location} onChange={set('location')} />
        <input type="number" placeholder="名額" value={form.capacity} onChange={set('capacity')} />
        <textarea placeholder="說明" value={form.description} onChange={set('description')} />
        <button onClick={createEvent}>新增</button>
      </div>
      <div className="card">
        <h3>活動列表</h3>
        <table><tbody>
          {events.map(e => (
            <tr key={e.id}>
              <td>{e.title}</td><td>{e.event_date}</td>
              <td><button className="secondary" onClick={() => setSelected(e.id)}>報名名單</button></td>
              <td><button className="secondary" onClick={() => deleteEvent(e.id)}>刪除</button></td>
            </tr>
          ))}
        </tbody></table>
      </div>
      {selected && (
        <div className="card">
          <h3>報名名單</h3>
          <p>
            <button className="secondary" onClick={exportCsv}>匯出 CSV</button>{' '}
            <button onClick={sendNotification}>寄通知信</button> <span className="muted">{msg}</span>
          </p>
          <table>
            <thead><tr><th>姓名</th><th>手機</th><th>Email</th><th>飲食</th><th>備註</th><th>繳費</th></tr></thead>
            <tbody>
              {regs.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td><td>{r.phone}</td><td>{r.email}</td><td>{r.diet}</td><td>{r.note}</td>
                  <td><button className="secondary" onClick={() => togglePaid(r)}>{r.paid ? '已繳費' : '標記已繳費'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
