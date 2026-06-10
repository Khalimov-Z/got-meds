import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  createPharmacyForm,
  getPharmacyManagementData,
  updatePharmacyForm,
  type AdminPharmacyCity,
  type AdminPharmacyRow,
} from "@/lib/actions/admin";
import { logoutAdmin, requireAdmin } from "@/lib/admin/auth";
import styles from "../admin.module.css";

type PharmaciesPageProps = {
  searchParams: Promise<{
    error?: string;
    created?: string;
    edit?: string;
    updated?: string;
  }>;
};

const TIER_OPTIONS = [
  { value: "TIER_1", label: "Tier 1 - киоск" },
  { value: "TIER_2", label: "Tier 2 - частная аптека" },
  { value: "TIER_3", label: "Tier 3 - сеть" },
] as const;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active - работает" },
  { value: "PAUSED", label: "Paused - временно скрыта" },
  { value: "CLOSED", label: "Closed - закрыта" },
] as const;

const DAY_FIELDS = [
  { key: "mon", label: "Пн" },
  { key: "tue", label: "Вт" },
  { key: "wed", label: "Ср" },
  { key: "thu", label: "Чт" },
  { key: "fri", label: "Пт" },
  { key: "sat", label: "Сб" },
  { key: "sun", label: "Вс" },
] as const;

function formatTier(tier: AdminPharmacyRow["tier"]) {
  return TIER_OPTIONS.find((option) => option.value === tier)?.label ?? tier;
}

function formatStatus(status: AdminPharmacyRow["status"]) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function getStatusClass(status: AdminPharmacyRow["status"]) {
  if (status === "ACTIVE") {
    return `${styles.statusBadge} ${styles.statusActive}`;
  }

  if (status === "PAUSED") {
    return `${styles.statusBadge} ${styles.statusPaused}`;
  }

  return `${styles.statusBadge} ${styles.statusClosed}`;
}

function formatCoordinates(pharmacy: AdminPharmacyRow) {
  return `${pharmacy.latitude.toFixed(6)}, ${pharmacy.longitude.toFixed(6)}`;
}

function getWorkingHoursValue(
  pharmacy: AdminPharmacyRow | undefined,
  key: (typeof DAY_FIELDS)[number]["key"]
) {
  const workingHours = pharmacy?.workingHours;

  if (!workingHours || typeof workingHours !== "object" || Array.isArray(workingHours)) {
    return "";
  }

  const value = (workingHours as Record<string, unknown>)[key];

  return typeof value === "string" ? value : "";
}

function PharmacyForm({
  cities,
  pharmacy,
}: {
  cities: AdminPharmacyCity[];
  pharmacy?: AdminPharmacyRow;
}) {
  const isEdit = Boolean(pharmacy);

  if (cities.length === 0) {
    return <div className={styles.emptyState}>Нет городов для привязки аптеки.</div>;
  }

  return (
    <form
      className={`${styles.form} ${styles.pharmacyForm}`}
      action={isEdit ? updatePharmacyForm : createPharmacyForm}
    >
      {pharmacy ? <input name="pharmacyId" type="hidden" value={pharmacy.id} /> : null}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Город</span>
          <select
            className={styles.select}
            name="cityId"
            defaultValue={pharmacy?.cityId ?? cities[0]?.id}
            required
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
                {city.isActive ? "" : " (выключен)"}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Название</span>
          <input
            className={styles.input}
            name="name"
            defaultValue={pharmacy?.name ?? ""}
            maxLength={140}
            required
          />
        </label>

        <label className={`${styles.field} ${styles.wideField}`}>
          <span>Адрес</span>
          <input
            className={styles.input}
            name="address"
            defaultValue={pharmacy?.address ?? ""}
            maxLength={220}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Широта</span>
          <input
            className={styles.input}
            name="latitude"
            type="number"
            step="0.000001"
            inputMode="decimal"
            defaultValue={pharmacy?.latitude ?? ""}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Долгота</span>
          <input
            className={styles.input}
            name="longitude"
            type="number"
            step="0.000001"
            inputMode="decimal"
            defaultValue={pharmacy?.longitude ?? ""}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Тип</span>
          <select
            className={styles.select}
            name="tier"
            defaultValue={pharmacy?.tier ?? "TIER_1"}
            required
          >
            {TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Статус</span>
          <select
            className={styles.select}
            name="status"
            defaultValue={pharmacy?.status ?? "ACTIVE"}
            required
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Телефон</span>
          <input
            className={styles.input}
            name="phone"
            defaultValue={pharmacy?.phone ?? ""}
            maxLength={80}
            type="tel"
          />
        </label>

        <label className={styles.field}>
          <span>WhatsApp</span>
          <input
            className={styles.input}
            name="whatsapp"
            defaultValue={pharmacy?.whatsapp ?? ""}
            maxLength={80}
            type="tel"
          />
        </label>

        <label className={`${styles.checkboxField} ${styles.wideField}`}>
          <input
            name="is247"
            type="checkbox"
            value="true"
            defaultChecked={pharmacy?.is247 ?? false}
          />
          <span>Круглосуточная аптека</span>
        </label>

        <fieldset className={`${styles.scheduleGrid} ${styles.wideField}`}>
          <legend>График работы</legend>
          {DAY_FIELDS.map((day) => (
            <label className={styles.field} key={day.key}>
              <span>{day.label}</span>
              <input
                className={styles.input}
                name={`workingHours_${day.key}`}
                defaultValue={getWorkingHoursValue(pharmacy, day.key)}
                placeholder="08:00-20:00"
              />
            </label>
          ))}
        </fieldset>

        <div className={`${styles.actionsRow} ${styles.wideField}`}>
          <button className={styles.primaryButton} type="submit">
            {isEdit ? "Сохранить изменения" : "Создать аптеку"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default async function PharmaciesPage({ searchParams }: PharmaciesPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const { cities, pharmacies } = await getPharmacyManagementData();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <BrandMark />
          <h1>Аптеки</h1>
          <p>Справочник аптек, координаты, график работы и статус на карте.</p>
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
        {params.created ? <div className={styles.notice}>Аптека создана.</div> : null}
        {params.updated ? <div className={styles.notice}>Аптека обновлена.</div> : null}

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Новая аптека</h2>
              <p>После сохранения аптека со статусом Active участвует в клиентской выдаче.</p>
            </div>
          </div>
          <PharmacyForm cities={cities} />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Справочник</h2>
              <p>{pharmacies.length} аптек в базе</p>
            </div>
          </div>

          {pharmacies.length > 0 ? (
            <table className={`${styles.reportTable} ${styles.pharmacyTable}`}>
              <thead>
                <tr>
                  <th>Аптека</th>
                  <th>Город</th>
                  <th>Адрес</th>
                  <th>Тип</th>
                  <th>Статус</th>
                  <th>Связь</th>
                  <th>График</th>
                </tr>
              </thead>
              {pharmacies.map((pharmacy) => (
                <tbody
                  className={styles.pharmacyGroup}
                  id={`pharmacy-${pharmacy.id}`}
                  key={pharmacy.id}
                >
                    <tr>
                      <td data-label="Аптека">
                        <strong>{pharmacy.name}</strong>
                        <span className={styles.tableMeta}>
                          {formatCoordinates(pharmacy)}
                        </span>
                      </td>
                      <td data-label="Город">{pharmacy.cityName}</td>
                      <td data-label="Адрес">{pharmacy.address}</td>
                      <td data-label="Тип">
                        <span className={styles.tierBadge}>{formatTier(pharmacy.tier)}</span>
                      </td>
                      <td data-label="Статус">
                        <span className={getStatusClass(pharmacy.status)}>
                          {formatStatus(pharmacy.status)}
                        </span>
                      </td>
                      <td data-label="Связь">
                        <span>{pharmacy.phone ?? "Телефон не указан"}</span>
                        <span className={styles.tableMeta}>
                          {pharmacy.whatsapp ?? "WhatsApp не указан"}
                        </span>
                      </td>
                      <td data-label="График">
                        {pharmacy.is247 ? "24/7" : "По графику"}
                      </td>
                    </tr>
                    <tr className={styles.detailRow}>
                      <td colSpan={7}>
                        <details
                          className={styles.rowDetails}
                          open={params.edit === pharmacy.id}
                        >
                          <summary className={styles.summaryButton}>
                            Редактировать: {pharmacy.name}
                          </summary>
                          <PharmacyForm cities={cities} pharmacy={pharmacy} />
                        </details>
                      </td>
                    </tr>
                </tbody>
              ))}
            </table>
          ) : (
            <div className={styles.emptyState}>
              Аптек пока нет. Создайте первую аптеку через форму выше.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
