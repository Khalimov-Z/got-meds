import Link from "next/link";
import { getInventoryUploadData } from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import { InventoryUploadForm } from "./inventory-upload-form";
import styles from "../admin.module.css";

export default async function InventoryUploadPage() {
  const admin = await requireAdmin();
  const pharmacies = await getInventoryUploadData();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link className={styles.logoMark} href="/admin" aria-label="GotMeds Admin">
            <span className={styles.logoPartPrimary}>Got</span>
            <span className={styles.logoPartSecondary}>Meds</span>
          </Link>
          <h1>Загрузка остатков</h1>
          <p>CSV должен содержать колонки «Название» и «Остаток».</p>
        </div>
        <div className={styles.adminMeta}>
          <span>{admin.email}</span>
          <Link className={styles.secondaryLink} href="/admin">
            Админ-панель
          </Link>
          <form action={logoutAdmin}>
            <button className={styles.logoutButton} type="submit">
              Выйти
            </button>
          </form>
        </div>
      </header>

      <section className={styles.content}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Прайс Tier 2 аптеки</h2>
              <p>Новая загрузка полностью заменяет старые остатки выбранной аптеки.</p>
            </div>
          </div>
          <InventoryUploadForm pharmacies={pharmacies} />
        </div>
      </section>
    </main>
  );
}
