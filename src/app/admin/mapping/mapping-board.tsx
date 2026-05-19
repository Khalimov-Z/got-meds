"use client";

import { useMemo, useState } from "react";
import { createAliasForm, ignoreAliasForm } from "@/lib/actions/admin";
import styles from "../admin.module.css";

type QueueItem = {
  id: string;
  rawString: string;
  pharmacy: {
    name: string;
    address: string;
  };
};

type ProductOption = {
  id: string;
  name: string;
  dosage: string | null;
  form: string | null;
};

function formatProductLabel(product: ProductOption) {
  return [product.name, product.dosage, product.form].filter(Boolean).join(" · ");
}

export function MappingBoard({
  queue,
  products,
}: {
  queue: QueueItem[];
  products: ProductOption[];
}) {
  const [queryByItemId, setQueryByItemId] = useState<Record<string, string>>({});

  const productsById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  if (queue.length === 0) {
    return <div className={styles.emptyState}>Очередь маппинга пуста.</div>;
  }

  return (
    <div className={styles.queueList}>
      {queue.map((item) => {
        const query = queryByItemId[item.id] ?? "";
        const normalizedQuery = query.trim().toLowerCase();
        const filteredProducts = normalizedQuery
          ? products.filter((product) =>
              formatProductLabel(product).toLowerCase().includes(normalizedQuery)
            )
          : products.slice(0, 20);

        return (
          <article className={styles.queueItem} key={item.id}>
            <div>
              <p className={styles.queueTitle}>{item.rawString}</p>
              <div className={styles.queueMeta}>
                <span>{item.pharmacy.name}</span>
                <span>{item.pharmacy.address}</span>
              </div>
            </div>

            <div className={styles.form}>
              <label className={styles.field}>
                <span>Поиск в эталонной базе</span>
                <input
                  className={styles.input}
                  value={query}
                  onChange={(event) =>
                    setQueryByItemId((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder="Начните вводить название"
                />
              </label>

              <form className={styles.form} action={createAliasForm}>
                <input name="unmappedStringId" type="hidden" value={item.id} />
                <label className={styles.field}>
                  <span>Препарат</span>
                  <select className={styles.select} name="productId" required>
                    <option value="">Выберите препарат</option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {formatProductLabel(productsById.get(product.id) ?? product)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.actionsRow}>
                  <button className={styles.primaryButton} type="submit">
                    Связать
                  </button>
                </div>
              </form>

              <form action={ignoreAliasForm}>
                <input name="unmappedStringId" type="hidden" value={item.id} />
                <button className={styles.dangerButton} type="submit">
                  Игнорировать
                </button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}
