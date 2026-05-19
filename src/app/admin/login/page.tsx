import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { LoginForm } from "./login-form";
import styles from "../admin.module.css";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  return (
    <main className={styles.narrowShell}>
      <section className={styles.loginPanel} aria-labelledby="admin-login-title">
        <Link className={styles.logoMark} href="/" aria-label="GotMeds">
          <span className={styles.logoPartPrimary}>Got</span>
          <span className={styles.logoPartSecondary}>Meds</span>
        </Link>
        <h1 id="admin-login-title">Вход администратора</h1>
        <p>Доступ к загрузке остатков и маппингу товаров.</p>
        <LoginForm />
      </section>
    </main>
  );
}
