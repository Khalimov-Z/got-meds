import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  getPartnerRequestsAction,
  updatePartnerRequestStatusForm,
  type AdminPartnerRequestRow,
} from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

type PartnerRequestsPageProps = {
  searchParams: Promise<{
    error?: string;
    updated?: string;
  }>;
};

const REQUEST_TYPE_LABELS: Record<AdminPartnerRequestRow["requestType"], string> = {
  ADD: "Подключить аптеку",
  EDIT: "Обновить контакты",
  DELETE: "Скрыть / удалить аптеку",
};

const REQUEST_STATUS_LABELS: Record<AdminPartnerRequestRow["status"], string> = {
  NEW: "Новая",
  PROCESSED: "Обработана",
  REJECTED: "Отклонена",
};

const statusOptions: Array<{ value: AdminPartnerRequestRow["status"]; label: string }> = [
  { value: "NEW", label: REQUEST_STATUS_LABELS.NEW },
  { value: "PROCESSED", label: REQUEST_STATUS_LABELS.PROCESSED },
  { value: "REJECTED", label: REQUEST_STATUS_LABELS.REJECTED },
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

function getRequestStatusClass(status: AdminPartnerRequestRow["status"]) {
  if (status === "PROCESSED") {
    return `${styles.statusBadge} ${styles.statusActive}`;
  }

  if (status === "REJECTED") {
    return `${styles.statusBadge} ${styles.statusPaused}`;
  }

  return `${styles.statusBadge} ${styles.statusClosed}`;
}

export default async function PartnerRequestsPage({ searchParams }: PartnerRequestsPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const result = await getPartnerRequestsAction();
  const requests = result.success && result.data ? result.data : [];

  const newRequestsCount = requests.filter((r) => r.status === "NEW").length;
  const processedRequestsCount = requests.filter((r) => r.status === "PROCESSED").length;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <BrandMark />
          <h1>Заявки от аптек</h1>
          <p>Обращения владельцев аптек на добавление, изменение или удаление данных.</p>
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

      <section className={styles.mainGrid} aria-label="Сводка заявок">
        <div className={styles.stat}>
          <span>Новые</span>
          <strong>{newRequestsCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>Обработано</span>
          <strong>{processedRequestsCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>Всего</span>
          <strong>{requests.length}</strong>
        </div>
      </section>

      <section className={styles.content} aria-label="Список заявок">
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Очередь обработки</h2>
              <p>
                Свяжитесь с владельцем по указанным контактам для проверки информации и обновите статус заявки.
              </p>
            </div>
          </div>

          {params.error ? <div className={styles.error}>{params.error}</div> : null}
          {params.updated ? <div className={styles.notice}>Статус заявки обновлен.</div> : null}

          {requests.length > 0 ? (
            <table className={`${styles.reportTable} ${styles.pharmacyTable}`}>
              <thead>
                <tr>
                  <th>Аптека</th>
                  <th>Тип запроса</th>
                  <th>Статус</th>
                  <th>Контакты</th>
                  <th>Сообщение</th>
                  <th>Дата</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td data-label="Аптека">
                      <strong>{request.pharmacyName}</strong>
                      <span className={styles.tableMeta}>{request.address}</span>
                    </td>
                    <td data-label="Тип запроса">
                      <strong>{REQUEST_TYPE_LABELS[request.requestType]}</strong>
                    </td>
                    <td data-label="Статус">
                      <span className={getRequestStatusClass(request.status)}>
                        {REQUEST_STATUS_LABELS[request.status]}
                      </span>
                    </td>
                    <td data-label="Контакты">
                      <strong>{request.representativeName}</strong>
                      <span className={styles.tableMeta}>{request.contactPhone}</span>
                    </td>
                    <td data-label="Сообщение" style={{ maxWidth: "220px", wordBreak: "break-word" }}>
                      {request.message || <em style={{ color: "var(--home-muted)" }}>Нет сообщения</em>}
                    </td>
                    <td data-label="Дата">
                      <time dateTime={request.createdAt.toISOString()}>
                        {formatDateTime(request.createdAt)}
                      </time>
                    </td>
                    <td data-label="Действие">
                      <form className={styles.reportStatusForm} action={updatePartnerRequestStatusForm}>
                        <input name="requestId" type="hidden" value={request.id} />
                        <select
                          className={styles.select}
                          name="status"
                          defaultValue={request.status}
                          aria-label="Статус заявки"
                        >
                          {statusOptions.map((option) => (
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
                        </div>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              Заявок пока нет. Новые обращения владельцев аптек появятся здесь после отправки из раздела сотрудничества.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
