"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAdmin, {});

  return (
    <form className={`${styles.form} ${styles.loginForm}`} action={formAction}>
      <label className={styles.field}>
        <span>Email</span>
        <span className={styles.loginInputWrap}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          <input
            className={styles.input}
            name="email"
            type="email"
            autoComplete="username"
            placeholder="example@gotmeds.ru"
            required
          />
        </span>
      </label>

      <label className={styles.field}>
        <span>Пароль</span>
        <span className={styles.loginInputWrap}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M12 14v2" />
          </svg>
          <input
            className={styles.input}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Введите пароль"
            required
          />
        </span>
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <button className={styles.primaryButton} type="submit" disabled={isPending}>
        {isPending ? "Проверяем" : "Войти в кабинет"}
      </button>
    </form>
  );
}
