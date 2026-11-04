import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Leaf, LoaderCircle } from 'lucide-react'
import { ApiError } from '@/services/apiError'
import { useAuth, type UserRole } from '@/auth/AuthContext'
import { homeForRole } from '@/components/auth/RequireAuth'

type Mode = 'login' | 'register'
type LocationState = { from?: string; notice?: string }
const inputClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'
const labelClass = 'block text-xs font-semibold text-slate-700'

export function AuthPage({ mode }: { mode: Mode }) {
  const { user, loading, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<Exclude<UserRole, 'ADMIN'>>('CUSTOMER')
  const [orgName, setOrgName] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [serviceCity, setServiceCity] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const state = location.state as LocationState | null

  if (!loading && user) return <Navigate to={homeForRole(user.role)} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setFieldErrors({}); setBusy(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else {
        const input: Record<string, unknown> = { name: name.trim(), email: email.trim(), password, role, ...(phone.trim() ? { phone: phone.trim() } : {}) }
        if (role === 'NGO') input.ngo = { orgName: orgName.trim(), ...(registrationNo.trim() ? { registrationNo: registrationNo.trim() } : {}), contactPhone: contactPhone.trim(), serviceCity: serviceCity.trim(), ...(serviceArea.trim() ? { serviceArea: serviceArea.trim() } : {}) }
        await register(input)
      }
      // The provider now owns the session; route according to the server-returned role.
      const next = state?.from
      navigate(next && next.startsWith('/') ? next : '/', { replace: true })
    } catch (cause) {
      if (cause instanceof ApiError) { setError(cause.message); setFieldErrors(cause.fieldErrors) }
      else setError(cause instanceof Error ? cause.message : 'Unable to complete this request. Please try again.')
    } finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-8 sm:px-6 sm:py-12">
    <div className="mx-auto grid min-h-[min(760px,calc(100vh-4rem))] max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 lg:grid-cols-[.92fr_1.08fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#123f32] p-10 text-white lg:flex"><div className="absolute -right-28 -top-24 size-80 rounded-full border-[52px] border-white/[.05]"/><Link to="/" className="relative inline-flex items-center gap-2 text-xl font-extrabold"><span className="grid size-10 place-items-center rounded-xl bg-emerald-600"><Leaf size={22}/></span>foodbridge<span className="text-orange-400">.</span></Link><div className="relative max-w-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-200">Good food. Less waste.</p><h1 className="mt-4 text-4xl font-bold leading-tight">A little good goes a long way.</h1><p className="mt-4 text-sm leading-7 text-emerald-50/75">Discover local favourites, share surplus food and help build a community where every meal matters.</p></div><p className="relative text-xs text-emerald-100/60">© {new Date().getFullYear()} FoodBridge</p></section>
      <section className="flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-700"><ArrowLeft size={14}/> Back to FoodBridge</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">{mode === 'login' ? 'Welcome back' : 'Join the community'}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
        <p className="mt-2 text-sm text-slate-500">{mode === 'login' ? 'Pick up right where you left off.' : 'A few details and you are ready to get started.'}</p>
        {mode === 'login' && state?.notice && <p role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">{state.notice}</p>}
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === 'register' && <div><label className={labelClass} htmlFor="name">Full name</label><input id="name" className={inputClass} value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={80} autoComplete="name" required/><FieldError message={fieldErrors.name}/></div>}
          <div><label className={labelClass} htmlFor="email">Email address</label><input id="email" type="email" className={inputClass} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/><FieldError message={fieldErrors.email}/></div>
          {mode === 'register' && <div><label className={labelClass} htmlFor="phone">Mobile number <span className="font-normal text-slate-400">(optional)</span></label><input id="phone" type="tel" inputMode="numeric" maxLength={10} className={inputClass} placeholder="10-digit Indian mobile number" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))} autoComplete="tel"/><FieldError message={fieldErrors.phone}/></div>}
          {mode === 'register' && <div><label className={labelClass} htmlFor="role">I am joining as</label><select id="role" className={inputClass} value={role} onChange={e=>setRole(e.target.value as Exclude<UserRole,'ADMIN'>)}><option value="CUSTOMER">Customer</option><option value="RESTAURANT_OWNER">Restaurant owner</option><option value="NGO">NGO / food organisation</option></select></div>}
          {mode === 'register' && role === 'NGO' && <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-xs font-bold text-emerald-900">NGO details</p><div><label className={labelClass} htmlFor="orgName">Organisation name</label><input id="orgName" className={inputClass} value={orgName} onChange={e=>setOrgName(e.target.value)} required/><FieldError message={fieldErrors['ngo.orgName']}/></div><div><label className={labelClass} htmlFor="registrationNo">Registration number <span className="font-normal text-slate-400">(optional)</span></label><input id="registrationNo" className={inputClass} value={registrationNo} onChange={e=>setRegistrationNo(e.target.value)} /></div><div><label className={labelClass} htmlFor="contactPhone">Contact mobile</label><input id="contactPhone" className={inputClass} inputMode="numeric" maxLength={10} value={contactPhone} onChange={e=>setContactPhone(e.target.value.replace(/\D/g,''))} required/><FieldError message={fieldErrors['ngo.contactPhone']}/></div><div><label className={labelClass} htmlFor="serviceCity">Service city</label><input id="serviceCity" className={inputClass} value={serviceCity} onChange={e=>setServiceCity(e.target.value)} required/><FieldError message={fieldErrors['ngo.serviceCity']}/></div><div><label className={labelClass} htmlFor="serviceArea">Service area <span className="font-normal text-slate-400">(optional)</span></label><input id="serviceArea" className={inputClass} value={serviceArea} onChange={e=>setServiceArea(e.target.value)}/></div></div>}
          <div><label className={labelClass} htmlFor="password">Password</label><div className="relative mt-1.5"><input id="password" type={showPassword?'text':'password'} className={`${inputClass} mt-0 pr-12`} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='register'?8:1} required/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='register'&&<p className="mt-1.5 text-[11px] text-slate-400">At least 8 characters, including a letter and a number.</p>}<FieldError message={fieldErrors.password}/></div>
          {mode === 'login' && <div className="flex justify-end"><Link to="/forgot-password" className="text-xs font-semibold text-emerald-700 hover:underline">Forgot password?</Link></div>}
          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</p>}
          <button disabled={busy || loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{busy&&<LoaderCircle size={16} className="animate-spin"/>}{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">{mode==='login'?"Don't have an account? ":'Already have an account? '}<Link to={mode==='login'?'/register':'/login'} className="font-bold text-emerald-700 hover:underline">{mode==='login'?'Create one':'Sign in'}</Link></p>
      </div></section>
    </div>
  </main>
}
function FieldError({message}:{message?:string}) { return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null }
