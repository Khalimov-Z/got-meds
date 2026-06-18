"use client";

import Link from "next/link";
import React, { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { submitPartnerRequestAction } from "@/lib/actions/partner";
import styles from "./partner.module.css";

export default function PartnerPage() {
  const [requestType, setRequestType] = useState("add");
  const [pharmacyName, setPharmacyName] = useState("");
  const [address, setAddress] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = pharmacyName.trim();
    const addr = address.trim();
    const rep = representativeName.trim();
    const phone = contactPhone.trim();

    if (!name || !addr || !rep || !phone) {
      setError("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    setIsPending(true);

    try {
      const result = await submitPartnerRequestAction({
        requestType,
        pharmacyName: name,
        address: addr,
        representativeName: rep,
        contactPhone: phone,
        message: message.trim(),
      });

      if (!result.success) {
        setError(result.error || "Не удалось отправить заявку.");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      console.error("Ошибка при отправке:", err);
      setError("Произошла неожиданная ошибка. Попробуйте позже.");
    } finally {
      setIsPending(false);
    }
  };

  const handleReset = () => {
    setPharmacyName("");
    setAddress("");
    setRepresentativeName("");
    setContactPhone("");
    setMessage("");
    setError(null);
    setSuccess(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <BrandMark />
          <Link href="/" className={styles.backLink}>
            Вернуться на главную
          </Link>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.card}>
          {success ? (
            <div className={styles.successBox}>
              <div className={styles.successIcon}>✓</div>
              <h2 className={styles.successTitle}>Заявка отправлена!</h2>
              <p className={styles.successText}>
                Спасибо за обращение. Наша служба модерации проверит информацию и свяжется с вами по указанному телефону в течение <strong>24 часов</strong>.
              </p>
              <button onClick={handleReset} className={styles.successButton}>
                Отправить другую заявку
              </button>
            </div>
          ) : (
            <>
              <h1 className={styles.cardTitle}>Сотрудничество с аптеками</h1>
              <p className={styles.cardSub}>
                Заполните форму ниже для добавления аптеки на карту, обновления контактов или скрытия информации.
              </p>

              <form onSubmit={handleSubmit} className={styles.form}>
                {error && <div className={styles.errorBanner}>{error}</div>}

                <div className={styles.formGroup}>
                  <label htmlFor="requestType" className={styles.label}>
                    Что вы хотите сделать? *
                  </label>
                  <select
                    id="requestType"
                    className={styles.select}
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="add">Подключить новую аптеку</option>
                    <option value="edit">Обновить контактные данные</option>
                    <option value="delete">Скрыть / удалить данные аптеки</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="pharmacyName" className={styles.label}>
                    Название аптеки *
                  </label>
                  <input
                    id="pharmacyName"
                    type="text"
                    className={styles.input}
                    placeholder="Например, Аптека Низких Цен"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="address" className={styles.label}>
                    Адрес аптеки *
                  </label>
                  <input
                    id="address"
                    type="text"
                    className={styles.input}
                    placeholder="Например, г. Гудермес, пр. Кирова, д. 12"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="representativeName" className={styles.label}>
                    Контактное лицо (Ваше имя) *
                  </label>
                  <input
                    id="representativeName"
                    type="text"
                    className={styles.input}
                    placeholder="Ваше имя и отчество"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="contactPhone" className={styles.label}>
                    Телефон / WhatsApp для связи *
                  </label>
                  <input
                    id="contactPhone"
                    type="tel"
                    className={styles.input}
                    placeholder="Например, +7 (928) 123-45-67"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message" className={styles.label}>
                    Детали запроса / Дополнительно
                  </label>
                  <textarea
                    id="message"
                    className={styles.textarea}
                    placeholder="Опишите ваши пожелания или детали изменений..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isPending}
                    maxLength={1000}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isPending}
                >
                  {isPending ? "Отправка..." : "Отправить заявку"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <p>
          © {new Date().getFullYear()} где.таблетка. Все права защищены. Имеются противопоказания.
        </p>
      </footer>
    </div>
  );
}
