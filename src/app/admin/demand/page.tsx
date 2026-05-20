import Link from "next/link";
import { getDemandDashboardData } from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

type DemandPageProps = {
  searchParams: Promise<{
    cityId?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export default async function DemandPage({ searchParams }: DemandPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const dashboard = await getDemandDashboardData(params.cityId);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link className={styles.logoMark} href="/admin" aria-label="GotMeds Admin">
            <span className={styles.logoPartPrimary}>Got</span>
            <span className={styles.logoPartSecondary}>Meds</span>
          </Link>
          <h1>Дефицитные позиции</h1>
          <p>Топ-50 поисковых запросов без результата за последнюю неделю.</p>
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

      <section className={styles.mainGrid} aria-label="Сводка дефицита">
        <div className={styles.stat}>
          <span>Период</span>
          <strong>{formatDate(dashboard.periodStart)}</strong>
          <span className={styles.tableMeta}>по {formatDate(dashboard.periodEnd)}</span>
        </div>
        <div className={styles.stat}>
          <span>Событий</span>
          <strong>{dashboard.totalLogsCount}</strong>
          <span className={styles.tableMeta}>нулевая выдача</span>
        </div>
        <div className={styles.stat}>
          <span>Позиций</span>
          <strong>{dashboard.rows.length}</strong>
          <span className={styles.tableMeta}>после объединения опечаток</span>
        </div>
      </section>

      <section className={styles.content} aria-label="Отчет дефицитных позиций">
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Отчет</h2>
              <p>
                Данные сгруппированы по выбранному городу и близким поисковым
                формулировкам.
              </p>
            </div>
            {dashboard.cities.length > 0 ? (
              <form className={styles.inlineFilter} action="/admin/demand">
                <label className={styles.field}>
                  <span>Город</span>
                  <select
                    className={styles.select}
                    name="cityId"
                    defaultValue={dashboard.selectedCityId ?? ""}
                  >
                    {dashboard.cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={styles.primaryButton} type="submit">
                  Показать
                </button>
              </form>
            ) : null}
          </div>

          {dashboard.rows.length > 0 ? (
            <table className={`${styles.reportTable} ${styles.demandTable}`}>
              <thead>
                <tr>
                  <th>Запрос</th>
                  <th>Город</th>
                  <th>Поисков</th>
                  <th>Последний запрос</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.rows.map((row) => (
                  <tr key={`${row.cityName}-${row.searchTerm}`}>
                    <td data-label="Запрос">
                      <strong>{row.searchTerm}</strong>
                      {row.variants.length > 0 ? (
                        <span className={styles.tableMeta}>
                          Объединено: {row.variants.join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Город">{row.cityName}</td>
                    <td data-label="Поисков">
                      <strong>{row.searchesCount}</strong>
                    </td>
                    <td data-label="Последний запрос">
                      <time dateTime={row.lastSearchedAt.toISOString()}>
                        {formatDateTime(row.lastSearchedAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              За последнюю неделю нет запросов с нулевой выдачей для выбранного
              города.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
