import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getAliasesData, deleteAliasForm } from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

type AliasesPageProps = {
  searchParams: Promise<{
    search?: string;
    page?: string;
    error?: string;
    deleted?: string;
  }>;
};

function formatProductMeta(row: {
  productDosage: string | null;
  productForm: string | null;
}) {
  const meta = [row.productDosage, row.productForm].filter(Boolean).join(" · ");
  return meta || "Дозировка и форма не указаны";
}

export default async function AliasesPage({ searchParams }: AliasesPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  
  const search = params.search?.trim() ?? "";
  const page = Number(params.page ?? "1");
  
  const { aliases, totalCount, totalPages, currentPage } = await getAliasesData(search, page);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <BrandMark />
          <h1>Синонимы (Алиасы)</h1>
          <p>Словарь сопоставлений сырых строк из 1С-выгрузок с эталонной базой.</p>
        </div>
        <div className={styles.adminMeta}>
          <span>{admin.email}</span>
          <Link className={styles.secondaryLink} href="/admin/mapping">
            Маппинг товаров
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
        {params.deleted ? <div className={styles.notice}>Связь синонима успешно удалена.</div> : null}

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Зарегистрированные сопоставления</h2>
              <p>Всего связей: {totalCount}</p>
            </div>
            
            <form method="GET" className={styles.inlineFilter}>
              <input
                className={styles.input}
                name="search"
                placeholder="Поиск по синониму или препарату..."
                defaultValue={search}
              />
              <button className={styles.primaryButton} type="submit">
                Найти
              </button>
            </form>
          </div>

          <div style={{ marginBottom: "20px", color: "var(--color-text-muted)", fontSize: "0.9rem", lineHeight: "1.4" }}>
            ⚠️ <strong>Внимание:</strong> Удаление связи сотрет сопоставление синонима из базы. Изменение остатков для аптек, которые использовали эту строку в прайс-листах, вступит в силу при следующем импорте их файлов.
          </div>

          {aliases.length > 0 ? (
            <>
              <table className={styles.reportTable}>
                <thead>
                  <tr>
                    <th>Сырая строка из 1С (Синоним)</th>
                    <th>Сопоставленный препарат</th>
                    <th style={{ width: "1%", whiteSpace: "nowrap", textAlign: "right" }}>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map((alias) => (
                    <tr key={alias.id}>
                      <td style={{ verticalAlign: "middle" }}>
                        <code style={{ fontSize: "0.95rem", color: "var(--color-primary)", fontWeight: 800 }}>
                          {alias.originalString}
                        </code>
                      </td>
                      <td style={{ verticalAlign: "middle" }}>
                        <strong>{alias.productName}</strong>
                        <span className={styles.tableMeta}>
                          {formatProductMeta(alias)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                        <form action={deleteAliasForm}>
                          <input type="hidden" name="aliasId" value={alias.id} />
                          <button
                            className={styles.dangerButton}
                            type="submit"
                            style={{ minHeight: "36px", padding: "0 12px" }}
                          >
                            Удалить
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 ? (
                <div className={styles.pagination}>
                  <Link
                    className={`${styles.secondaryLink} ${currentPage <= 1 ? styles.disabledLink : ""}`}
                    href={{
                      pathname: "/admin/aliases",
                      query: { search, page: currentPage - 1 },
                    }}
                    aria-disabled={currentPage <= 1}
                  >
                    Назад
                  </Link>
                  <span className={styles.pageIndicator}>
                    Страница {currentPage} из {totalPages}
                  </span>
                  <Link
                    className={`${styles.secondaryLink} ${currentPage >= totalPages ? styles.disabledLink : ""}`}
                    href={{
                      pathname: "/admin/aliases",
                      query: { search, page: currentPage + 1 },
                    }}
                    aria-disabled={currentPage >= totalPages}
                  >
                    Вперед
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.emptyState}>
              Синонимы не найдены. {search ? "Попробуйте изменить поисковый запрос." : "Загрузите прайс-листы и сопоставьте неразспознанные строки."}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
