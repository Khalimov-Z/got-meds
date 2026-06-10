"use client";

import { useActionState } from "react";
import { uploadPharmacyPriceForm } from "@/lib/actions/admin";
import styles from "../admin.module.css";

type PharmacyOption = {
  id: string;
  name: string;
  address: string;
};

export function InventoryUploadForm({ pharmacies }: { pharmacies: PharmacyOption[] }) {
  const [state, formAction, isPending] = useActionState(uploadPharmacyPriceForm, {});

  if (pharmacies.length === 0) {
    return <div className={styles.emptyState}>Нет активных Tier 2 аптек для загрузки.</div>;
  }

  return (
    <>
      <form className={styles.form} action={formAction}>
        <label className={styles.field}>
          <span>Аптека</span>
          <select className={styles.select} name="pharmacyId" required>
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name} — {pharmacy.address}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>CSV / XLS</span>
          <input
            className={styles.fileInput}
            name="file"
            type="file"
            accept=".csv,.xls,text/csv"
            required
          />
        </label>

        {state.error ? <p className={styles.error}>{state.error}</p> : null}

        <button
          className={`${styles.primaryButton} ${styles.compactSubmitButton}`}
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Загружаем" : "Загрузить"}
        </button>
      </form>

      {state.report ? (
        <table className={styles.reportTable}>
          <tbody>
            <tr>
              <th scope="row">Всего строк</th>
              <td>{state.report.totalRows}</td>
            </tr>
            <tr>
              <th scope="row">Распознано</th>
              <td>{state.report.recognizedRows}</td>
            </tr>
            <tr>
              <th scope="row">Требуют ручного маппинга</th>
              <td>{state.report.unmappedRows}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </>
  );
}
