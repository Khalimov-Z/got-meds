import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { LoginForm } from "./login-form";
import styles from "../admin.module.css";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  return (
    <main className={`${styles.narrowShell} ${styles.loginShell}`}>
      <header className={styles.loginTopBar}>
        <BrandMark />
        <Link className={styles.loginHomeLink} href="/">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          На главную
        </Link>
      </header>

      <section className={styles.loginPanel} aria-labelledby="admin-login-title">
        <h1 id="admin-login-title">Администратор</h1>
        <p>Введите учетные данные для доступа в систему</p>
        <LoginForm />
        <p className={styles.loginFootnote}>
          Доступ только для авторизованного персонала аптек и сервиса
        </p>
      </section>

      <p className={styles.loginDisclaimer}>
        Сервис носит информационный характер. Имеются противопоказания. Не
        является публичной офертой
      </p>
    </main>
  );
}
