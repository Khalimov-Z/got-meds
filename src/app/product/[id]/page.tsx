import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { getAnalogs, getProductDetails } from "@/lib/actions/products";
import { ProductAnalogs } from "./product-analogs";
import styles from "./product-page.module.css";

const CATEGORY_LABELS = {
  medicine: "Лекарство",
  equipment: "Медтехника",
  vitamins: "Витамины и БАДы",
  mother_and_baby: "Мать и дитя",
};

const CATEGORY_ICONS = {
  medicine: "medication",
  vitamins: "spa",
  equipment: "devices_other",
  mother_and_baby: "child_care",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatPrice(price?: number) {
  if (typeof price !== "number") {
    return "Цена уточняется";
  }

  return `${new Intl.NumberFormat("ru-RU").format(price)} ₽`;
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getProductDetails(id);

  if (!result.success || !result.data) {
    return {
      title: "Препарат не найден | GotMeds",
    };
  }

  const product = result.data;
  const title = `Купить ${product.name} в Гудермесе — наличие в аптеках, цены | GotMeds`;
  const description = `Поиск препарата ${product.name} в аптеках Гудермеса. Адреса дежурных аптек, цены и наличие на карте города.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/product/${product.id}`,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const [result, analogsResult] = await Promise.all([
    getProductDetails(id),
    getAnalogs(id),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const product = result.data;
  const analogs = analogsResult.success ? analogsResult.data ?? [] : [];

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <BrandMark />
        <Link className={styles.backLink} href="/">
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          <span>Назад к поиску</span>
        </Link>
      </header>

      <section className={styles.productHero} aria-labelledby="product-title">
        {/* Left: Product Image & Spotlight */}
        <div className={styles.visualWrapper}>
          <div className={styles.spotlight} aria-hidden="true" />
          <div className={styles.productVisual}>
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className={styles.productImage}
              />
            ) : (
              <div className={styles.productFallback}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {CATEGORY_ICONS[product.category] || "medication"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Product Information */}
        <div className={styles.productContent}>
          <div className={styles.titleSection}>
            <span className={styles.categoryLabel}>
              {CATEGORY_LABELS[product.category] || "Препарат"}
            </span>
            <h1 id="product-title">{product.name}</h1>
            <p className={styles.description}>
              {product.description || "Описание препарата пока уточняется."}
            </p>
          </div>

          {/* Price & Action Section */}
          <div className={styles.actionPanel}>
            <div className={styles.priceRow}>
              <span className={styles.priceLabel}>Средняя цена в аптеках</span>
              <div className={styles.priceValue}>
                {product.price_estimate ? (
                  <>
                    <span className={styles.pricePrefix}>от</span>
                    <span className={styles.priceAmount}>{formatPrice(product.price_estimate)}</span>
                  </>
                ) : (
                  <span className={styles.pricePending}>Цена уточняется</span>
                )}
              </div>
            </div>

            <div className={styles.actionRow}>
              <Link
                className={styles.mapAction}
                href={{
                  pathname: "/map",
                  query: { q: product.name },
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">map</span>
                <span>Найти на карте</span>
              </Link>
            </div>
          </div>

          {/* Specs Grid (Bento Style) */}
          <div className={styles.specsGrid}>
            {product.dosage && (
              <div className={`${styles.specCard} ${styles.specDosage}`}>
                <span className="material-symbols-outlined" aria-hidden="true">medication</span>
                <div className={styles.specText}>
                  <span className={styles.specLabel}>Дозировка</span>
                  <span className={styles.specValue}>{product.dosage}</span>
                </div>
              </div>
            )}
            {product.form && (
              <div className={`${styles.specCard} ${styles.specForm}`}>
                <span className="material-symbols-outlined" aria-hidden="true">opacity</span>
                <div className={styles.specText}>
                  <span className={styles.specLabel}>Форма выпуска</span>
                  <span className={styles.specValue}>{product.form}</span>
                </div>
              </div>
            )}
            {product.active_ingredient && (
              <div className={`${styles.specCard} ${styles.specIngredient}`}>
                <span className="material-symbols-outlined" aria-hidden="true">science</span>
                <div className={styles.specText}>
                  <span className={styles.specLabel}>Действующее вещество</span>
                  <span className={styles.specValue}>{product.active_ingredient}</span>
                </div>
              </div>
            )}
          </div>

          {product.is_prescription && (
            <div className={styles.prescriptionAlert} role="note">
              <span className="material-symbols-outlined" aria-hidden="true">warning</span>
              <span>Отпускается строго по рецепту врача</span>
            </div>
          )}

          <ProductAnalogs analogs={analogs} category={product.category} />
        </div>
      </section>

      {/* Disclaimer Block */}
      <div className={styles.disclaimerBlock} role="note">
        <span className="material-symbols-outlined" aria-hidden="true">warning</span>
        <p>
          ИМЕЮТСЯ ПРОТИВОПОКАЗАНИЯ. ПЕРЕД ПРИМЕНЕНИЕМ НЕОБХОДИМО
          ПРОКОНСУЛЬТИРОВАТЬСЯ СО СПЕЦИАЛИСТОМ. Информация о товаре
          предоставлена для ознакомления и не является публичной офертой.
        </p>
      </div>
    </main>
  );
}
