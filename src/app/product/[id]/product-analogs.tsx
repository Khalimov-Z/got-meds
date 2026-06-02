"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  CategoryBabyIcon,
  CategoryEquipmentIcon,
  CategoryMedicineIcon,
  CategoryVitaminsIcon,
} from "@/components/map/icons";
import styles from "./product-page.module.css";

type ProductAnalog = {
  id: string;
  name: string;
  active_ingredient?: string;
  form?: string;
  dosage?: string;
  image_url: string;
};

type ProductAnalogsProps = {
  analogs: ProductAnalog[];
  category: "medicine" | "equipment" | "vitamins" | "mother_and_baby";
};

const CATEGORY_ICONS = {
  medicine: CategoryMedicineIcon,
  vitamins: CategoryVitaminsIcon,
  equipment: CategoryEquipmentIcon,
  mother_and_baby: CategoryBabyIcon,
};

function getDetails(analog: ProductAnalog) {
  return [analog.form, analog.dosage].filter(Boolean).join(", ");
}

export function ProductAnalogs({ analogs, category }: ProductAnalogsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();

  if (analogs.length === 0) {
    return null;
  }

  return (
    <section className={styles.analogs} aria-label="Аналоги препарата">
      <button
        className={styles.secondaryAction}
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "Скрыть аналоги" : "Показать аналоги"}
      </button>

      {isOpen ? (
        <div className={styles.analogList} id={listId}>
          {analogs.map((analog) => {
            const details = getDetails(analog);
            const CategoryIcon = CATEGORY_ICONS[category] ?? CategoryMedicineIcon;

            return (
              <article className={styles.analogCard} key={analog.id}>
                <div className={styles.analogVisual} aria-hidden="true">
                  {analog.image_url ? (
                    <div
                      className={styles.analogImage}
                      style={{ backgroundImage: `url(${analog.image_url})` }}
                    />
                  ) : (
                    <div className={styles.analogFallback}>
                      <CategoryIcon aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className={styles.analogContent}>
                  <h2>{analog.name}</h2>
                  {details ? <p>{details}</p> : null}
                  {analog.active_ingredient ? (
                    <span>{analog.active_ingredient}</span>
                  ) : null}
                </div>

                <Link
                  className={styles.analogAction}
                  href={{
                    pathname: "/map",
                    query: { q: analog.name },
                  }}
                >
                  Показать на карте
                </Link>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
