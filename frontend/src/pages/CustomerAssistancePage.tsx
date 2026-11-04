import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, HeartHandshake } from 'lucide-react'
import {
  createAssistanceRequest,
  type AssistanceRequirement,
} from '@/services/assistance'

const requirementOptions: AssistanceRequirement[] = [
  'Cooked meal',
  'Dry ration',
  'Baby food',
  'Drinking water',
  'Any food',
]

export function CustomerAssistancePage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [people, setPeople] = useState('1')
  const [requirements, setRequirements] = useState<AssistanceRequirement[]>([])
  const [foodType, setFoodType] = useState<'VEG' | 'NON_VEG' | ''>('')
  const [location, setLocation] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: createAssistanceRequest,
    onSuccess: () => {
      setSubmitted(true)
      setName('')
      setPhone('')
      setPeople('1')
      setRequirements([])
      setFoodType('')
      setLocation('')
      setCity('')
      setNotes('')
    },
  })

  function toggleRequirement(item: AssistanceRequirement) {
    setRequirements((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(false)

    mutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
      people: Number(people),
      requirements,
      ...(foodType ? { foodType } : {}),
      location: location.trim(),
      city: city.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <HeartHandshake size={18} />
          Food assistance
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Request food assistance
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Tell us what you need. Verified NGOs in your area can review and accept your request.
        </p>
      </div>

      {submitted && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Request submitted successfully</p>
            <p className="mt-1">You can track its progress from My Assistance Requests.</p>
          </div>
        </div>
      )}

      {mutation.isError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{mutation.error instanceof Error ? mutation.error.message : 'Could not submit your request. Please try again.'}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <section className="space-y-4">
          <h2 className="font-semibold text-slate-900">Contact details</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Full name
              <input
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Mobile number
              <input
                required
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <label className="block max-w-xs space-y-1.5 text-sm font-medium text-slate-700">
            Number of people
            <input
              required
              type="number"
              min={1}
              max={500}
              value={people}
              onChange={(event) => setPeople(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </section>

        <div className="border-t border-slate-100" />

        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">Food requirements</h2>
          <p className="text-sm text-slate-500">Select one or more options.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {requirementOptions.map((item) => (
              <label
                key={item}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                  requirements.includes(item)
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={requirements.includes(item)}
                  onChange={() => toggleRequirement(item)}
                  className="h-4 w-4 accent-emerald-600"
                />
                {item}
              </label>
            ))}
          </div>

          <label className="block max-w-xs space-y-1.5 text-sm font-medium text-slate-700">
            Food preference (optional)
            <select
              value={foodType}
              onChange={(event) => setFoodType(event.target.value as 'VEG' | 'NON_VEG' | '')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">No preference</option>
              <option value="VEG">Vegetarian</option>
              <option value="NON_VEG">Non-vegetarian</option>
            </select>
          </label>
        </section>

        <div className="border-t border-slate-100" />

        <section className="space-y-4">
          <h2 className="font-semibold text-slate-900">Location details</h2>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            City
            <input
              required
              minLength={2}
              maxLength={60}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Your city"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Complete location / address
            <textarea
              required
              minLength={5}
              maxLength={250}
              rows={3}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Enter your area, locality and address"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Additional notes (optional)
            <textarea
              maxLength={300}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any details that may help the NGO..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </section>

        <button
          type="submit"
          disabled={mutation.isPending || requirements.length === 0}
          className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? 'Submitting request...' : 'Submit assistance request'}
        </button>

        {requirements.length === 0 && (
          <p className="text-center text-xs text-slate-500">
            Select at least one food requirement to continue.
          </p>
        )}
      </form>
    </div>
  )
}
