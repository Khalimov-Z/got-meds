"use client";

import { RefreshIcon } from "@/components/map/icons";
import styles from "./offline.module.css";

export function RetryButton() {
  return (
    <button
      className={styles.action}
      type="button"
      onClick={() => window.location.reload()}
    >
      <RefreshIcon aria-hidden="true" />
      <span>Попробовать снова</span>
    </button>
  );
}
