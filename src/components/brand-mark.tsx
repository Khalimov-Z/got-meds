import Link from "next/link";
import styles from "./brand-mark.module.css";

type BrandMarkProps = {
  href?: string;
  label?: string;
};

export function BrandMark({ href = "/", label = "GotMeds" }: BrandMarkProps) {
  return (
    <Link className={styles.brand} href={href} aria-label={label}>
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" role="img" focusable="false">
          <g transform="rotate(-42 12 12)">
            <rect x="4.2" y="9" width="15.6" height="6" rx="3" />
            <path className={styles.divider} d="M12 9v6" />
          </g>
        </svg>
      </span>
      <span className={styles.name}>Got Meds</span>
    </Link>
  );
}
