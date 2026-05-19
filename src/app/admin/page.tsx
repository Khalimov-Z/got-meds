import Link from "next/link";
import { getAdminHomeStats } from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import styles from "./admin.module.css";

export default async function AdminPage() {
  const admin = await requireAdmin();
  const stats = await getAdminHomeStats();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link className={styles.logoMark} href="/" aria-label="GotMeds">
            <span className={styles.logoPartPrimary}>Got</span>
            <span className={styles.logoPartSecondary}>Meds</span>
          </Link>
          <h1>Админ-панель</h1>
          <p>Операции с остатками, алиасами и очередью маппинга.</p>
        </div>
        <div className={styles.adminMeta}>
          <span>{admin.email}</span>
          <form action={logoutAdmin}>
            <button className={styles.logoutButton} type="submit">
              Выйти
            </button>
          </form>
        </div>
      </header>

      <section className={styles.mainGrid} aria-label="Сводка админки">
        <div className={styles.stat}>
          <span>Tier 2 аптек</span>
          <strong>{stats.tier2PharmaciesCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>В очереди маппинга</span>
          <strong>{stats.unmappedCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>Алиасов</span>
          <strong>{stats.aliasesCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>В черном списке</span>
          <strong>{stats.restrictedProductsCount}</strong>
        </div>
      </section>

      <section className={styles.navGrid} aria-label="Разделы админки">
        <Link className={styles.navCard} href="/admin/inventory-upload">
          <h2>Загрузка остатков</h2>
          <p>CSV-прайс Tier 2 аптеки и полное замещение `Inventory`.</p>
          <span className={styles.secondaryLink}>Открыть</span>
        </Link>
        <Link className={styles.navCard} href="/admin/mapping">
          <h2>Маппинг товаров</h2>
          <p>Связать нераспознанные строки с эталонной базой или игнорировать мусор.</p>
          <span className={styles.secondaryLink}>Открыть</span>
        </Link>
        <Link className={styles.navCard} href="/admin/blacklist">
          <h2>Черный список</h2>
          <p>Ограничить поиск товаров социального риска на уровне бэкенда.</p>
          <span className={styles.secondaryLink}>Открыть</span>
        </Link>
      </section>
    </main>
  );
}
