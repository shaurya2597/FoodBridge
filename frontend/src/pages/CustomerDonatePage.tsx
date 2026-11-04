import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Leaf,
  Package,
  Utensils,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import {
  createFoodDonation,
  type CreateDonationInput,
  type DonationCategory,
} from '@/services/donor'

const categories: DonationCategory[] = [
  'Cooked meal',
  'Bakery',
  'Packaged food',
  'Fruits & vegetables',
  'Beverages',
  'Other',
]

const shelfLifeHours: Record<DonationCategory, number> = {
  'Cooked meal': 12,
  Bakery: 48,
  'Packaged food': 168,
  'Fruits & vegetables': 168,
  Beverages: 48,
  Other: 168,
}

function localDateTime(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

export function CustomerDonatePage() {
  const navigate = useNavigate()
  const [foodName, setFoodName] = useState('')
  const [category, setCategory] = useState<DonationCategory>('Cooked meal')
  const [quantity, setQuantity] = useState('')
  const [servings, setServings] = useState('10')
  const [foodType, setFoodType] = useState<'VEG' | 'NON_VEG'>('VEG')
  const [preparedAt, setPreparedAt] = useState(localDateTime())
  const [expiresAt, setExpiresAt] = useState(localDateTime(12 * 60))
  const [pickupAddress, setPickupAddress] = useState('')
  const [city, setCity] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const [safetyConfirmed, setSafetyConfirmed] = useState(false)
  const [validationError, setValidationError] = useState('')

  const mutation = useMutation({
    mutationFn: (input: CreateDonationInput) => createFoodDonation(input),
    onSuccess: () => {
      setValidationError('')
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError('')
    mutation.reset()

    const prepared = new Date(preparedAt)
    const expires = new Date(expiresAt)
    const now = new Date()

    if (!safetyConfirmed) {
      setValidationError('Please confirm that the food is safe to eat.')
      return
    }
    if (prepared.getTime() > now.getTime() + 5 * 60_000) {
      setValidationError('Preparation time cannot be in the future.')
      return
    }
    if (expires.getTime() < now.getTime() + 30 * 60_000) {
      setValidationError('Food must remain available for at least 30 more minutes.')
      return
    }
    if (expires <= prepared) {
      setValidationError('Consume-before time must be after preparation time.')
      return
    }
    if (expires.getTime() - prepared.getTime() > shelfLifeHours[category] * 60 * 60_000) {
      setValidationError(
        `${category} can be donated for at most ${shelfLifeHours[category]} hours after preparation.`,
      )
      return
    }
    if (!/^[6-9]\d{9}$/.test(contactPhone.trim())) {
      setValidationError('Enter a valid 10-digit Indian mobile number.')
      return
    }

    const input: CreateDonationInput = {
      foodName: foodName.trim(),
      category,
      quantity: quantity.trim(),
      servings: Number(servings),
      foodType,
      preparedAt: prepared.toISOString(),
      expiresAt: expires.toISOString(),
      pickupAddress: pickupAddress.trim(),
      city: city.trim(),
      contactPhone: contactPhone.trim(),
      imageUrl: imageUrl.trim() || undefined,
      instructions: instructions.trim() || undefined,
      safetyConfirmed: true,
    }

    mutation.mutate(input)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
          Share food, spread kindness
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Donate surplus food
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Have extra food? Share it with verified NGOs so it can reach people
          who need it. Add accurate details to help arrange a safe pickup.
        </p>
      </div>

      {mutation.isSuccess ? (
        <Card className="rounded-2xl border-emerald-200 shadow-sm">
          <CardContent className="p-8 text-center sm:p-12">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={34} />
            </span>
            <h2 className="mt-5 text-xl font-bold text-slate-900">
              Your donation is posted!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Thank you for sharing food. Your donation is now visible to NGOs
              so a verified organisation can request it.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  mutation.reset()
                  setFoodName('')
                  setQuantity('')
                  setInstructions('')
                  setImageUrl('')
                  setSafetyConfirmed(false)
                }}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Donate more food
              </button>
              <button
                type="button"
                onClick={() => navigate('/customer')}
                className="rounded-xl bg-[#123f32] px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
              >
                Back to dashboard
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-7">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Utensils size={20} />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Food details</h2>
                  <p className="text-xs text-slate-500">Tell NGOs what you are donating.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Food name *">
                  <input required minLength={2} maxLength={100} value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="e.g. Vegetable pulao" className={inputClass} />
                </Field>
                <Field label="Category *">
                  <select value={category} onChange={e => {
                    const next = e.target.value as DonationCategory
                    setCategory(next)
                    setExpiresAt(localDateTime(shelfLifeHours[next] * 60))
                  }} className={inputClass}>
                    {categories.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Quantity *">
                  <input required minLength={1} maxLength={60} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g. 3 containers / 2 kg" className={inputClass} />
                </Field>
                <Field label="Number of servings *">
                  <input required type="number" min={1} max={5000} value={servings} onChange={e => setServings(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Food type *">
                  <select value={foodType} onChange={e => setFoodType(e.target.value as 'VEG' | 'NON_VEG')} className={inputClass}>
                    <option value="VEG">Vegetarian</option>
                    <option value="NON_VEG">Non-vegetarian</option>
                  </select>
                </Field>
                <Field label="Food image URL (optional)">
                  <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/food.jpg" className={inputClass} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-7">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-700">
                  <Clock3 size={20} />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Preparation and expiry</h2>
                  <p className="text-xs text-slate-500">Set accurate food-safety timings.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prepared at *">
                  <input required type="datetime-local" value={preparedAt} max={localDateTime(5)} onChange={e => setPreparedAt(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Consume before *">
                  <input required type="datetime-local" value={expiresAt} min={localDateTime(30)} onChange={e => setExpiresAt(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Maximum time after preparation: {shelfLifeHours[category]} hours for {category.toLowerCase()}.
                Food must remain collectable for at least 30 minutes after submission.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-7">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-700">
                  <Package size={20} />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Pickup details</h2>
                  <p className="text-xs text-slate-500">Help an NGO find and collect the food.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City *">
                  <input required minLength={2} maxLength={60} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Jodhpur" className={inputClass} />
                </Field>
                <Field label="Contact mobile number *">
                  <input required inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" className={inputClass} />
                </Field>
              </div>
              <Field label="Full pickup address *">
                <textarea required minLength={10} maxLength={250} rows={3} value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="House/building, street, area, landmark..." className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </Field>
              <Field label="Instructions for NGO (optional)">
                <textarea maxLength={500} rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Pickup instructions, storage details, or other useful information..." className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={safetyConfirmed} onChange={e => setSafetyConfirmed(e.target.checked)} className="mt-1 size-4 accent-emerald-700" />
                <span>
                  <span className="block text-sm font-bold text-emerald-950">
                    I confirm that this food is safe to eat. *
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-emerald-800">
                    I have provided accurate preparation and expiry details, and the food has been stored and handled safely.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          {validationError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {validationError}
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
              <p className="text-sm font-semibold text-red-800">Donation could not be posted</p>
              <p className="mt-1 text-xs leading-5 text-red-700">{userMessage(mutation.error)}</p>
            </div>
          )}

          <div className="flex flex-col-reverse items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:p-5">
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Leaf size={17} className="text-emerald-700" />
              Your donation helps reduce food waste.
            </p>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123f32] px-6 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <HeartHandshake size={18} />
              {mutation.isPending ? 'Posting donation...' : 'Post food donation'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
