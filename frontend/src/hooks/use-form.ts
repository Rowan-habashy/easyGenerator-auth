import { useCallback, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { getErrorMessage } from '../errors'

export type Validator<T> = (value: string, values: T) => string | undefined

export type ValidatorMap<T> = {
  [K in keyof T]?: Validator<T>
}

type FormErrors<T> = Partial<Record<keyof T, string>>

const validateValues = <T extends Record<string, string>>(values: T, validators: ValidatorMap<T>): FormErrors<T> => {
  const nextErrors: FormErrors<T> = {}

  ;(Object.keys(validators) as Array<keyof T>).forEach((key) => {
    const validator = validators[key]
    if (!validator) return

    const message = validator(values[key], values)
    if (message) nextErrors[key] = message
  })

  return nextErrors
}

export function useForm<T extends Record<string, string>>(
  initialValues: T,
  validators: ValidatorMap<T>,
  onSubmitValues: (values: T) => Promise<void> | void,
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors<T>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const runValidation = useCallback((next: T) => validateValues(next, validators), [validators])

  const bind = useCallback(
    (name: keyof T) => ({
      value: values[name],
      error: errors[name],
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value

        setValues((prev) => {
          const next = { ...prev, [name]: value } as T
          if (errors[name]) {
            setErrors(runValidation(next))
          }
          return next
        })
      },
    }),
    [errors, runValidation, values],
  )

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setFormError(null)

      const nextErrors = runValidation(values)
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) return

      try {
        setSubmitting(true)
        await onSubmitValues(values)
      } catch (error) {
        setFormError(getErrorMessage(error))
      } finally {
        setSubmitting(false)
      }
    },
    [onSubmitValues, runValidation, values],
  )

  return useMemo(() => ({ bind, handleSubmit, formError, submitting }), [bind, formError, handleSubmit, submitting])
}
