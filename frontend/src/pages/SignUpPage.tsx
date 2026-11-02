import { Link } from 'react-router-dom'
import { routes } from '../routes'
import { useAuth } from '../hooks/use-auth'
import { LIMITS } from '../validation'
import { useForm } from '../hooks/use-form'
import { validateEmail, validateName, validateNewPassword } from '../validation/validators'
import { Alert, Brand, Button, Card, Field } from '../design-system'

export function SignUpPage() {
  const { signUp } = useAuth()
  const { bind, handleSubmit, formError, submitting } = useForm(
    { name: '', email: '', password: '' },
    { name: validateName, email: validateEmail, password: validateNewPassword },
    (values) => signUp({ name: values.name.trim(), email: values.email.trim(), password: values.password }),
  )

  return (
  <Card>
      <Brand />
      <h1 className="mb-1 mt-4 text-2xl font-bold">Create your account</h1>
      <p className="mb-5 text-slate-500">It only takes a minute.</p>
      <form onSubmit={handleSubmit} noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field id="name" label="Name" autoComplete="name" {...bind('name')} />
        <Field id="email" label="Email" type="email" autoComplete="email" {...bind('email')} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" {...bind('password')} />
  <p className="-mt-2 mb-4 text-sm text-slate-500">At least {LIMITS.PASSWORD_MIN} characters.</p>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
      <p className="mt-6 text-center text-slate-500">
        Already registered?{' '}
        <Link className="font-semibold text-brand-500 hover:underline" to={routes.login}>
          Log in
        </Link>
      </p>
    </Card>
  )
}
