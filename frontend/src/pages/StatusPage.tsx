import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import { getHealth } from '@/services/health'
import { config } from '@/utils/config'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-all">{value}</dd>
    </div>
  )
}

/** M0 proof-of-life page: asks the backend for its health and shows the result. */
export function StatusPage() {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
  })

  const state = isPending ? 'loading' : error ? 'error' : data?.database === 'down' ? 'degraded' : 'ok'

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">FoodBridge</CardTitle>
          <CardDescription>Good food. Delivered with care. (Setup check, milestone M0)</CardDescription>
        </CardHeader>

        <CardContent aria-live="polite" aria-busy={isPending}>
          {state === 'loading' && <p role="status">Checking the API…</p>}

          {state === 'ok' && data && (
            <div role="status">
              <Badge className="bg-green-600 text-white hover:bg-green-600">API connected</Badge>
              <dl className="mt-3 divide-y">
                <Row label="Backend address" value={config.apiUrl} />
                <Row label="Database" value="Up" />
                <Row label="Payments" value={data.razorpay === 'test-keys' ? 'Razorpay test mode' : 'Demo mode (no real money)'} />
                <Row label="Demo payments allowed" value={data.demoPayments ? 'Yes' : 'No'} />
              </dl>
            </div>
          )}

          {state === 'degraded' && (
            <div role="status">
              <Badge variant="destructive">API reachable, database down</Badge>
              <p className="mt-3 text-sm">
                The backend answered, but it cannot reach PostgreSQL. Check that PostgreSQL is running and that DATABASE_URL in
                backend/.env is correct.
              </p>
            </div>
          )}

          {state === 'error' && (
            <div role="alert">
              <Badge variant="destructive">Cannot reach the API</Badge>
              <p className="mt-3 text-sm">{userMessage(error)}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Is the backend running? In the backend folder: npm.cmd run dev</li>
                <li>Is it on {config.apiUrl}? Check VITE_API_URL in frontend/.env</li>
                <li>Does backend/.env allow this site? CLIENT_URL must include http://localhost:5173</li>
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Checking…' : 'Check again'}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
