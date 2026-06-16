import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getMappingData } from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import { MappingBoard } from "./mapping-board";
import styles from "../admin.module.css";

type MappingPageProps = {
  searchParams: Promise<{
    error?: string;
    mapped?: string;
    ignored?: string;
  }>;
};

export default async function MappingPage({ searchParams }: MappingPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const { queue, products } = await getMappingData();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <BrandMark />
          <h1>Маппинг товаров</h1>
          <p>Связь строк из CSV с эталонной базой препаратов.</p>
        </div>
        <div className={styles.adminMeta}>
          <span>{admin.email}</span>
          <Link className={styles.secondaryLink} href="/admin/aliases">
            Синонимы (Алиасы)
          </Link>
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
        {params.error ? <div className={styles.error}>{params.error}</div> : null}
        {params.mapped ? <div className={styles.notice}>Alias создан.</div> : null}
        {params.ignored ? <div className={styles.notice}>Строка добавлена в игнор.</div> : null}

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Требуют внимания</h2>
              <p>{queue.length} строк в очереди</p>
            </div>
          </div>
          <MappingBoard queue={queue} products={products} />
        </div>
      </section>
    </main>
  );
}
