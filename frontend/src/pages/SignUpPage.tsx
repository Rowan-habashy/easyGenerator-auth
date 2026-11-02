import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { authenticate, type User } from '../api'
import { getErrorMessage } from '../errors'
import { LIMITS } from '../validation'
import { Alert, Brand, Button, Card, Field } from '../components/ui'

interface SignUpForm {
  name: string
  email: string
  password: string
}

export function SignUpPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [serverError, setServerError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>()

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setServerError('')
    try {
      onLogin(await authenticate('/auth/signup', { name: name.trim(), email: email.trim(), password }))
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  })

  return (
    <Card>
      <Brand />
      <h1 className="mb-1 mt-4 text-2xl font-bold">Create your account</h1>
      <p className="mb-5 text-slate-500">It only takes a minute.</p>
      <form onSubmit={onSubmit} noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <Field
          id="name"
          label="Name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name', {
            validate: (v) => v.trim().length > 0 || 'Name is required.',
            maxLength: { value: LIMITS.NAME_MAX, message: `Name must be at most ${LIMITS.NAME_MAX} characters.` },
          })}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password', {
            required: 'Password is required.',
            minLength: { value: LIMITS.PASSWORD_MIN, message: `Password must be at least ${LIMITS.PASSWORD_MIN} characters.` },
            maxLength: { value: LIMITS.PASSWORD_MAX, message: `Password must be at most ${LIMITS.PASSWORD_MAX} characters.` },
          })}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
      <p className="mt-6 text-center text-slate-500">
        Already registered?{' '}
        <Link className="font-semibold text-brand-500 hover:underline" to="/login">
          Log in
        </Link>
      </p>
    </Card>
  )
}
