import { BrandMark } from "@/components/brand-mark";
import { WifiOffIcon } from "@/components/map/icons";
import styles from "./offline.module.css";
import { RetryButton } from "./retry-button";

export const metadata = {
  title: "Нет связи | GotMeds",
  description: "Offline-экран GotMeds для нестабильного мобильного интернета.",
};

export default function OfflinePage() {
  return (
    <main className={styles.shell}>
      <section className={styles.content} aria-labelledby="offline-title">
        <BrandMark />
        <div className={styles.statusIcon} aria-hidden="true">
          <WifiOffIcon />
        </div>
        <div className={styles.copy}>
          <p className={styles.kicker}>Нет подключения</p>
          <h1 id="offline-title">Похоже, пропала связь.</h1>
          <p>
            Как только интернет появится, мы продолжим поиск. Попробуйте
            обновить страницу, чтобы проверить соединение.
          </p>
        </div>
        <RetryButton />
      </section>
    </main>
  );
}
