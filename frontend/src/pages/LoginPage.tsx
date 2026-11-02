import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { authenticate, type User } from '../api'
import { getErrorMessage } from '../errors'
import { LIMITS } from '../validation'
import { Alert, Brand, Button, Card, Field } from '../components/ui'

interface LoginForm {
  email: string
  password: string
}

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [serverError, setServerError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>()

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError('')
    try {
      onLogin(await authenticate('/auth/signin', { email: email.trim(), password }))
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  })

  return (
    <Card>
      <Brand />
      <h1 className="mb-1 mt-4 text-2xl font-bold">Welcome back</h1>
      <p className="mb-5 text-slate-500">Log in to your account.</p>
      <form onSubmit={onSubmit} noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email', {
            required: 'Email is required.',
            maxLength: { value: LIMITS.EMAIL_MAX, message: 'Email is too long.' },
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
          })}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { required: 'Password is required.' })}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-slate-500">
        New here?{' '}
        <Link className="font-semibold text-brand-500 hover:underline" to="/signup">
          Create an account
        </Link>
      </p>
    </Card>
  )
}
