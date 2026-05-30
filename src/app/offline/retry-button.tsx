"use client";

import styles from "./offline.module.css";

export function RetryButton() {
  return (
    <button
      className={styles.action}
      type="button"
      onClick={() => window.location.reload()}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        refresh
      </span>
      <span>Попробовать снова</span>
    </button>
  );
}
