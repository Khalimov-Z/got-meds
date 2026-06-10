import Link from "next/link";
import styles from "./brand-mark.module.css";

type BrandMarkProps = {
  href?: string;
  label?: string;
};

export function BrandMark({ href = "/", label = "где.таблетка" }: BrandMarkProps) {
  return (
    <Link className={styles.brand} href={href} aria-label={label}>
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" role="img" focusable="false">
          <path
            className={styles.pin}
            d="M32 5.5c-12.1 0-22 9.7-22 21.7 0 15.8 22 31.3 22 31.3s22-15.5 22-31.3c0-12-9.9-21.7-22-21.7Z"
          />
          <circle className={styles.pinHole} cx="32" cy="27" r="13.6" />
          <g className={styles.pill} transform="rotate(-90 32 27)">
            <rect x="21.8" y="21.9" width="20.4" height="10.2" rx="5.1" />
            <path className={styles.divider} d="M32 21.9v10.2" />
          </g>
        </svg>
      </span>
      <span className={styles.name}>{label}</span>
    </Link>
  );
}
