import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/** Shown when a page crashes while loading. It never prints technical details (stack traces) to visitors. */
export function RouteErrorPage() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'An unexpected error occurred.'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center" role="alert">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">{detail}</p>
      <Button onClick={() => window.location.reload()}>Reload the page</Button>
    </main>
  )
}
