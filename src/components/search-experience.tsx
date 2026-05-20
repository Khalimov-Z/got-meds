"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

function getInitials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "G";
}

export function SearchExperience() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
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

  return (
    <main className={styles.shell}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.brandBar}>
          <div className={styles.brand}>
            <span className={styles.logoMark} aria-label="GotMeds">
              <span className={styles.logoPartPrimary}>Got</span>
              <span className={styles.logoPartSecondary}>Meds</span>
            </span>
          </div>
          <Link className={styles.adminEntry} href="/admin">
            Администратор
          </Link>
        </div>

        <div className={styles.heroCopy}>
          <h1 id="home-title">Найди лекарство в Гудермесе</h1>
          <p>
            Быстрый поиск по препаратам, витаминам и медтехнике с учетом
            опечаток.
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
            <input
              ref={inputRef}
              id="medicine-search"
              className={styles.searchInput}
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Введите название препарата"
              autoComplete="off"
              spellCheck={false}
            />
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
      </section>

      <section className={styles.howItWorks} aria-labelledby="how-it-works-title">
        <h2 id="how-it-works-title">Как это работает?</h2>
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
        <span>Поиск данного препарата ограничен сервисом GotMeds согласно правилам платформы</span>
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
        {results.map((result) => (
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
                {!result.image_url ? (
                  <span>{getInitials(result.name)}</span>
                ) : null}
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
        ))}
      </ul>
    </div>
  );
}
