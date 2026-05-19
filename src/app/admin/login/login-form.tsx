"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAdmin, {});

  return (
    <form className={styles.form} action={formAction}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          className={styles.input}
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </label>

      <label className={styles.field}>
        <span>Пароль</span>
        <input
          className={styles.input}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <button className={styles.primaryButton} type="submit" disabled={isPending}>
        {isPending ? "Проверяем" : "Войти"}
      </button>
    </form>
  );
}
