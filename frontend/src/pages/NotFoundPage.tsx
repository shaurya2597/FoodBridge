import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">We could not find that page</h1>
      <p className="text-muted-foreground">The address may be mistyped, or the page may have moved.</p>
      <Link to="/" className={buttonVariants()}>
        Go to the home page
      </Link>
    </main>
  )
}
