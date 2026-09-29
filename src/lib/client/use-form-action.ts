"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState for forms, minus React 19's automatic form reset. Passing a
 * function to <form action> clears every field once the action settles —
 * even when the server rejected the input — so a typo in one field would
 * wipe the rest. Submitting from onSubmit keeps what the user typed.
 */
export function useFormAction<T>(fn: (prev: NoInfer<T> | null, form: FormData) => Promise<T>) {
  const [state, dispatch, pending] = useActionState<T | null, FormData>(fn, null);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(e.currentTarget, submitter instanceof HTMLButtonElement ? submitter : null);
    startTransition(() => dispatch(form));
  }
  return [state, onSubmit, pending] as const;
}
