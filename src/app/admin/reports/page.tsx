import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  getPharmacyReportsData,
  updatePharmacyReportStatusForm,
  type AdminPharmacyReportRow,
  type PharmacyReportStatus,
  type PharmacyReportType,
} from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

type ReportsPageProps = {
  searchParams: Promise<{
    error?: string;
    updated?: string;
  }>;
};

const REPORT_TYPE_LABELS: Record<PharmacyReportType, string> = {
  WRONG_NUMBER: "Неверный номер",
  CLOSED: "Аптека закрыта",
  FAKE_STOCK: "Препарата нет в наличии",
};

const REPORT_STATUS_LABELS: Record<PharmacyReportStatus, string> = {
  NEW: "New - новая",
  IN_PROGRESS: "In progress - в работе",
  RESOLVED: "Resolved - решена",
};

const reportStatusOptions: Array<{ value: PharmacyReportStatus; label: string }> = [
  { value: "NEW", label: REPORT_STATUS_LABELS.NEW },
  { value: "IN_PROGRESS", label: REPORT_STATUS_LABELS.IN_PROGRESS },
  { value: "RESOLVED", label: REPORT_STATUS_LABELS.RESOLVED },
];

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

function getReportStatusClass(status: AdminPharmacyReportRow["status"]) {
  if (status === "RESOLVED") {
    return `${styles.statusBadge} ${styles.statusActive}`;
  }

  if (status === "IN_PROGRESS") {
    return `${styles.statusBadge} ${styles.statusPaused}`;
  }

  return `${styles.statusBadge} ${styles.statusClosed}`;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const reports = await getPharmacyReportsData();
  const newReportsCount = reports.filter((report) => report.status === "NEW").length;
  const activeReportsCount = reports.filter(
    (report) => report.status !== "RESOLVED"
  ).length;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <BrandMark />
          <h1>Жалобы</h1>
          <p>Пользовательские сообщения о неверных данных аптек.</p>
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

      <section className={styles.mainGrid} aria-label="Сводка жалоб">
        <div className={styles.stat}>
          <span>Новые</span>
          <strong>{newReportsCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>Активные</span>
          <strong>{activeReportsCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>Всего</span>
          <strong>{reports.length}</strong>
        </div>
      </section>

      <section className={styles.content} aria-label="Очередь жалоб">
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Очередь модерации</h2>
              <p>
                Проверьте аптеку, обновите справочник и переведите жалобу в
                решенный статус.
              </p>
            </div>
          </div>

          {params.error ? <div className={styles.error}>{params.error}</div> : null}
          {params.updated ? <div className={styles.notice}>Статус жалобы обновлен.</div> : null}

          {reports.length > 0 ? (
            <table className={`${styles.reportTable} ${styles.pharmacyTable}`}>
              <thead>
                <tr>
                  <th>Аптека</th>
                  <th>Тип</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td data-label="Аптека">
                      <strong>{report.pharmacy.name}</strong>
                      <span className={styles.tableMeta}>{report.pharmacy.address}</span>
                      <span className={styles.tableMeta}>IP: {report.userIp}</span>
                    </td>
                    <td data-label="Тип">{REPORT_TYPE_LABELS[report.type]}</td>
                    <td data-label="Статус">
                      <span className={getReportStatusClass(report.status)}>
                        {REPORT_STATUS_LABELS[report.status]}
                      </span>
                    </td>
                    <td data-label="Дата">
                      <time dateTime={report.createdAt.toISOString()}>
                        {formatDateTime(report.createdAt)}
                      </time>
                    </td>
                    <td data-label="Действие">
                      <form className={styles.reportStatusForm} action={updatePharmacyReportStatusForm}>
                        <input name="reportId" type="hidden" value={report.id} />
                        <select
                          className={styles.select}
                          name="status"
                          defaultValue={report.status}
                          aria-label="Статус жалобы"
                        >
                          {reportStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className={styles.reportActionButtons}>
                          <button
                            className={`${styles.primaryButton} ${styles.compactAction}`}
                            type="submit"
                          >
                            Сохранить
                          </button>
                          <Link
                            className={`${styles.primaryButton} ${styles.compactAction}`}
                            href={
                              report.pharmacy.id
                                ? `/admin/pharmacies?edit=${report.pharmacy.id}#pharmacy-${report.pharmacy.id}`
                                : "/admin/pharmacies"
                            }
                          >
                            Редактировать
                          </Link>
                        </div>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              Жалоб пока нет. Новые сообщения пользователей появятся здесь после
              отправки с карты.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
