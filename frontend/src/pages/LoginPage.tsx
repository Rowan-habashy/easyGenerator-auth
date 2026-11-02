import { Link } from 'react-router-dom'
import { routes } from '../routes'
import { useAuth } from '../hooks/use-auth'
import { useForm } from '../hooks/use-form'
import { validateEmail, validateRequired } from '../validation/validators'
import { Alert, Brand, Button, Card, Field } from '../design-system'

export function LoginPage() {
  const { signIn } = useAuth()
  const { bind, handleSubmit, formError, submitting } = useForm(
    { email: '', password: '' },
    { email: validateEmail, password: validateRequired('Password') },
    (values) => signIn({ email: values.email.trim(), password: values.password }),
  )

  return (
  <Card>
      <Brand />
      <h1 className="mb-1 mt-4 text-2xl font-bold">Welcome back</h1>
      <p className="mb-5 text-slate-500">Log in to your account.</p>
      <form onSubmit={handleSubmit} noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field id="email" label="Email" type="email" autoComplete="email" {...bind('email')} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" {...bind('password')} />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-slate-500">
        New here?{' '}
        <Link className="font-semibold text-brand-500 hover:underline" to={routes.signUp}>
          Create an account
        </Link>
      </p>
    </Card>
  )
}
