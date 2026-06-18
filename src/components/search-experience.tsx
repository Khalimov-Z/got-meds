"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CategoryBabyIcon,
  CategoryEquipmentIcon,
  CategoryMedicineIcon,
  CategoryVitaminsIcon,
} from "@/components/map/icons";
import { BrandMark } from "@/components/brand-mark";
import { logZeroResultSearchForActiveCity } from "@/lib/actions/search";
import styles from "./search-experience.module.css";

type SearchCategory = "medicine" | "equipment" | "vitamins" | "mother_and_baby";

interface SearchResultItem {
  id: string;
  name: string;
  category: SearchCategory;
  is_prescription: boolean;
  image_url: string;
  price_estimate: number | null;
  similarity_score: number;
  restricted?: boolean;
}

interface SearchResponse {
  success: boolean;
  data?: SearchResultItem[];
  restricted?: boolean;
  restricted_product_name?: string;
  error?: string;
}

type SearchStatus = "idle" | "loading" | "success" | "empty" | "restricted" | "error";

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  medicine: "Лекарство",
  equipment: "Медтехника",
  vitamins: "Витамины",
  mother_and_baby: "Мать и дитя",
};

const QUICK_SEARCHES = ["Медтехника", "Витамины", "Мать и дитя"];
const ZERO_RESULT_LOG_DELAY_MS = 1500;
const MIN_ZERO_RESULT_LOG_LENGTH = 3;

const HOW_IT_WORKS = [
  {
    title: "Введи название",
    text: "Напиши название препарата или аппарата в поиск.",
  },
  {
    title: "Выбери на карте",
    text: "Система покажет ближайшие аптеки, где товар числится в наличии.",
  },
  {
    title: "Свяжись в 1 клик",
    text: "Нажми WhatsApp или Позвонить, чтобы уточнить наличие.",
  },
  {
    title: "Забери",
    text: "Построй маршрут прямо в приложении и отправляйся за заказом.",
  },
];

function formatPrice(price: number | null) {
  if (price === null) {
    return "Цена уточняется";
  }

  return `от ${new Intl.NumberFormat("ru-RU").format(price)} ₽`;
}

const CATEGORY_ICONS = {
  medicine: CategoryMedicineIcon,
  vitamins: CategoryVitaminsIcon,
  equipment: CategoryEquipmentIcon,
  mother_and_baby: CategoryBabyIcon,
} satisfies Record<SearchCategory, typeof CategoryMedicineIcon>;

/**
 * Содержимое шапки сайта (логотип и служебная кнопка администратора).
 */
function HeaderContent() {
  return (
    <>
      <BrandMark />
      <Link className={styles.adminEntry} href="/admin">
        Администратор
      </Link>
    </>
  );
}

export function SearchExperience() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [stepHeight, setStepHeight] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loggedZeroResultQueriesRef = useRef<Set<string>>(new Set());

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  const updateQuery = (nextQuery: string) => {
    const normalizedQuery = nextQuery.trim();

    setQuery(nextQuery);
    setResults([]);
    setErrorMessage("");
    setStatus(normalizedQuery ? "loading" : "idle");
  };

  useEffect(() => {
    const isDesktopInput = window.matchMedia("(pointer: fine)").matches;
    if (isDesktopInput) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    let animationFrameId = 0;

    const updateHeaderPosition = () => {
      animationFrameId = 0;
      const shouldApplyGlass = window.scrollY > 0;

      setIsHeaderScrolled((currentValue) =>
        currentValue === shouldApplyGlass ? currentValue : shouldApplyGlass
      );
    };

    const requestHeaderPositionUpdate = () => {
      if (animationFrameId === 0) {
        animationFrameId = window.requestAnimationFrame(updateHeaderPosition);
      }
    };

    updateHeaderPosition();
    window.addEventListener("scroll", requestHeaderPositionUpdate, { passive: true });
    window.addEventListener("resize", requestHeaderPositionUpdate);

    return () => {
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener("scroll", requestHeaderPositionUpdate);
      window.removeEventListener("resize", requestHeaderPositionUpdate);
    };
  }, []);

  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const params = new URLSearchParams({ q: trimmedQuery });
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Не удалось выполнить поиск.");
        }

        if (payload.restricted) {
          setResults([]);
          setStatus("restricted");
          return;
        }

        const nextResults = payload.data ?? [];
        setResults(nextResults);
        setStatus(nextResults.length > 0 ? "success" : "empty");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setResults([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не удалось выполнить поиск. Попробуйте позже."
        );
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    if (status !== "empty" || trimmedQuery.length < MIN_ZERO_RESULT_LOG_LENGTH) {
      return;
    }

    const normalizedQuery = trimmedQuery.toLowerCase();
    if (loggedZeroResultQueriesRef.current.has(normalizedQuery)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loggedZeroResultQueriesRef.current.add(normalizedQuery);
      void logZeroResultSearchForActiveCity(trimmedQuery).then((result) => {
        if (!result.success) {
          loggedZeroResultQueriesRef.current.delete(normalizedQuery);
        }
      });
    }, ZERO_RESULT_LOG_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [status, trimmedQuery]);

  useEffect(() => {
    const updateHeights = () => {
      const stepEl = document.querySelector(`.${styles.step}`);
      if (stepEl) {
        setStepHeight(stepEl.getBoundingClientRect().height);
      }
    };

    const timeoutId = setTimeout(updateHeights, 100);
    window.addEventListener("resize", updateHeights);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateHeights);
    };
  }, []);

  const heroSearchStateClass =
    status === "loading" || status === "success"
      ? styles.heroWithResults
      : status === "empty" || status === "restricted" || status === "error"
        ? styles.heroWithFeedback
        : "";

  return (
    <main className={styles.shell}>
      <header className={`${styles.siteHeader} ${isHeaderScrolled ? styles.siteHeaderScrolled : ""}`}>
        <div className={styles.headerInner}>
          <HeaderContent />
        </div>
      </header>

      <section className={`${styles.hero} ${heroSearchStateClass}`} aria-labelledby="home-title">
        <div className={styles.heroFrame}>
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <div className={styles.heroCopy}>
                <h1 id="home-title">
                  Найди лекарство <span>в Гудермесе</span>
                </h1>
                <p>
                  Мгновенный поиск наличия и цен в аптеках города. Заботьтесь о
                  здоровье без лишних поездок.
                </p>
              </div>

              <div className={styles.searchPanel}>
                <form
                  className={styles.searchForm}
                  role="search"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <label className={styles.searchLabel} htmlFor="medicine-search">
                    Поиск препарата
                  </label>
                  <div className={styles.searchField}>
                    <svg
                      className={styles.searchIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="m16 16 4 4" />
                    </svg>
                    <input
                      ref={inputRef}
                      id="medicine-search"
                      className={styles.searchInput}
                      value={query}
                      onChange={(event) => updateQuery(event.target.value)}
                      placeholder="Введите название препарата..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </form>

                <div className={styles.quickSearches} aria-label="Популярные категории">
                  {QUICK_SEARCHES.map((item) => (
                    <button
                      key={item}
                      className={styles.quickButton}
                      type="button"
                      onClick={() => updateQuery(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <SearchResults
                  status={status}
                  query={trimmedQuery}
                  results={results}
                  errorMessage={errorMessage}
                />
              </div>
            </div>

            <div className={styles.heroArtwork} aria-hidden="true">
              <svg className={styles.pulseGraphic} viewBox="0 0 420 420" fill="none">
                <circle className={styles.pulseHalo} cx="210" cy="210" r="118" />
                <circle className={styles.pulseHaloEcho} cx="210" cy="210" r="118" />
                <circle className={styles.pulseHaloLate} cx="210" cy="210" r="118" />
                <path
                  className={styles.pulseTrace}
                  d="M58 214h58l15-24 17 48 17-116 23 160 19-68h31l14-24 18 48 18-74 18 50h56"
                  pathLength="1"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.howItWorks} aria-labelledby="how-it-works-title">
        <h2 id="how-it-works-title">
          Как работает <span className={styles.headingBrand}>где.таблетка</span>?
        </h2>
        <div className={styles.steps}>
          {HOW_IT_WORKS.map((step, index) => (
            <article className={styles.step} key={step.title}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.partnerSection} aria-labelledby="partner-section-title">
        <h2 id="partner-section-title" className={styles.partnerSectionTitle}>
          Для владельцев аптек
        </h2>
        <div
          className={styles.partnerBanner}
          style={stepHeight ? { minHeight: `${stepHeight}px` } : undefined}
        >
          <div className={styles.partnerInner}>
            <div className={styles.partnerCopy}>
              <h2 id="partner-title">Владелец аптеки?</h2>
              <p>
                Подключите свою аптеку к поиску <span>где.таблетка</span>, обновите контактные данные или отправьте запрос на скрытие информации.
              </p>
            </div>
            <Link href="/partner" className={styles.partnerLink}>
              Стать партнером
            </Link>
          </div>
        </div>
      </section>

      <p className={styles.disclaimer}>
        Сервис носит информационный характер. Имеются противопоказания. Не
        является публичной офертой
      </p>
    </main>
  );
}

function SearchResults({
  status,
  query,
  results,
  errorMessage,
}: {
  status: SearchStatus;
  query: string;
  results: SearchResultItem[];
  errorMessage: string;
}) {
  if (status === "idle") {
    return null;
  }

  if (status === "loading") {
    return (
      <div className={styles.resultsArea} aria-live="polite">
        <ul className={styles.resultList} aria-label="Загрузка результатов">
          {Array.from({ length: 3 }).map((_, index) => (
            <li className={styles.skeletonCard} key={index}>
              <span className={styles.skeletonThumb} />
              <span className={styles.skeletonLines}>
                <span />
                <span />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.feedback} role="status">
        <strong>Поиск временно недоступен</strong>
        <span>{errorMessage || "Не удалось выполнить поиск. Попробуйте позже."}</span>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className={styles.feedback} role="status">
        <strong>Препарат не найден</strong>
        <span>
          Возможно, он снят с производства или мы еще не добавили его в базу.
        </span>
      </div>
    );
  }

  if (status === "restricted") {
    return (
      <div className={`${styles.feedback} ${styles.restrictedFeedback}`} role="status">
        <span className={styles.restrictedIcon} aria-hidden="true" />
        <span>Поиск данного препарата ограничен сервисом где.таблетка согласно правилам платформы</span>
      </div>
    );
  }

  return (
    <div className={styles.resultsArea} aria-live="polite">
      <div className={styles.resultsHeader}>
        <span>Результаты по запросу</span>
        <strong>{query}</strong>
      </div>
      <ul className={styles.resultList}>
        {results.map((result) => {
          const CategoryIcon = CATEGORY_ICONS[result.category] ?? CategoryMedicineIcon;

          return (
            <li key={result.id}>
              <Link className={styles.resultCard} href={`/product/${result.id}`}>
                <div
                  className={`${styles.productImage} ${
                    result.image_url ? styles.productImageWithSource : ""
                  }`}
                  style={
                    result.image_url
                      ? { backgroundImage: `url(${result.image_url})` }
                      : undefined
                  }
                  aria-hidden="true"
                >
                  {!result.image_url ? <CategoryIcon aria-hidden="true" /> : null}
                </div>
                <div className={styles.productInfo}>
                  <div className={styles.productTitleRow}>
                    <h3>{result.name}</h3>
                    {result.is_prescription ? (
                      <span className={styles.prescriptionBadge}>По рецепту</span>
                    ) : null}
                  </div>
                  <div className={styles.productMeta}>
                    <span>{CATEGORY_LABELS[result.category]}</span>
                    <span>{formatPrice(result.price_estimate)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
