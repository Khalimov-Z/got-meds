import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnalogs, getProductDetails } from "@/lib/actions/products";
import { ProductAnalogs } from "./product-analogs";
import styles from "./product-page.module.css";

const CATEGORY_LABELS = {
  medicine: "Лекарство",
  equipment: "Медтехника",
  vitamins: "Витамины",
  mother_and_baby: "Мать и дитя",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatPrice(price?: number) {
  if (typeof price !== "number") {
    return "Цена уточняется";
  }

  return `от ${new Intl.NumberFormat("ru-RU").format(price)} ₽`;
}

function getInitials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "G";
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
        <Link className={styles.logoMark} href="/" aria-label="GotMeds">
          <span className={styles.logoPartPrimary}>Got</span>
          <span className={styles.logoPartSecondary}>Meds</span>
        </Link>
        <Link className={styles.backLink} href="/">
          Назад к поиску
        </Link>
      </header>

      <section className={styles.productHero} aria-labelledby="product-title">
        <div className={styles.productVisual} aria-hidden="true">
          {product.image_url ? (
            <div
              className={styles.productImage}
              style={{ backgroundImage: `url(${product.image_url})` }}
            />
          ) : (
            <div className={styles.productFallback}>{getInitials(product.name)}</div>
          )}
        </div>

        <div className={styles.productContent}>
          <span className={styles.categoryPill}>
            {CATEGORY_LABELS[product.category]}
          </span>
          <h1 id="product-title">{product.name}</h1>

          {product.is_prescription ? (
            <div className={styles.prescriptionAlert} role="note">
              Отпускается строго по рецепту врача
            </div>
          ) : null}

          <p className={styles.description}>
            {product.description || "Описание препарата пока уточняется."}
          </p>

          <dl className={styles.productFacts}>
            <div>
              <dt>Примерная цена</dt>
              <dd>{formatPrice(product.price_estimate)}</dd>
            </div>
            {product.active_ingredient ? (
              <div>
                <dt>Действующее вещество</dt>
                <dd>{product.active_ingredient}</dd>
              </div>
            ) : null}
            {product.form ? (
              <div>
                <dt>Форма</dt>
                <dd>{product.form}</dd>
              </div>
            ) : null}
            {product.dosage ? (
              <div>
                <dt>Дозировка</dt>
                <dd>{product.dosage}</dd>
              </div>
            ) : null}
          </dl>

          <Link
            className={styles.primaryAction}
            href={{
              pathname: "/map",
              query: { q: product.name },
            }}
          >
            Найти на карте
          </Link>

          <ProductAnalogs analogs={analogs} />
        </div>
      </section>

      <p className={styles.disclaimer}>
        Сервис носит информационный характер. Имеются противопоказания. Не
        является публичной офертой
      </p>
    </main>
  );
}
