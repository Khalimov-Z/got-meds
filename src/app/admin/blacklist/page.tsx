import Link from "next/link";
import {
  getBlacklistManagementData,
  toggleProductSocialRiskForm,
} from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

type BlacklistPageProps = {
  searchParams: Promise<{
    error?: string;
    updated?: string;
  }>;
};

function formatProductMeta(product: {
  dosage: string | null;
  form: string | null;
}) {
  const meta = [product.dosage, product.form].filter(Boolean).join(" · ");

  return meta || "Форма и дозировка не указаны";
}

export default async function BlacklistPage({ searchParams }: BlacklistPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const { products, restrictedCount } = await getBlacklistManagementData();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link className={styles.logoMark} href="/admin" aria-label="GotMeds Admin">
            <span className={styles.logoPartPrimary}>Got</span>
            <span className={styles.logoPartSecondary}>Meds</span>
          </Link>
          <h1>Черный список</h1>
          <p>Управление ограничением поиска для товаров социального риска.</p>
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
        {params.error ? <div className={styles.error}>{params.error}</div> : null}
        {params.updated ? <div className={styles.notice}>Статус товара обновлен.</div> : null}

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Товары</h2>
              <p>
                Ограничено: {restrictedCount} из {products.length}
              </p>
            </div>
          </div>

          {products.length > 0 ? (
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <span className={styles.tableMeta}>
                        {formatProductMeta(product)}
                      </span>
                    </td>
                    <td>
                      {product.isSocialRisk ? (
                        <span className={styles.restrictedBadge}>Ограничен</span>
                      ) : (
                        <span className={styles.allowedBadge}>Разрешен</span>
                      )}
                    </td>
                    <td>
                      <form action={toggleProductSocialRiskForm}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input
                          type="hidden"
                          name="isSocialRisk"
                          value={String(!product.isSocialRisk)}
                        />
                        <button
                          className={
                            product.isSocialRisk
                              ? styles.ghostButton
                              : styles.dangerButton
                          }
                          type="submit"
                        >
                          {product.isSocialRisk ? "Снять ограничение" : "Ограничить поиск"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              Товары отсутствуют. Сначала загрузите эталонную базу.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

