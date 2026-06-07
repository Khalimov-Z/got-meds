"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { BrandMark } from "@/components/brand-mark";
import type {
  PharmacyByProductItem,
  ProductDetails,
} from "@/lib/actions/products";
import { submitPharmacyReport } from "@/lib/actions/reports";
import styles from "./map-experience.module.css";
import {
  SearchIcon,
  ClearIcon,
  MapIcon,
  ListIcon,
  LocationIcon,
  ClockIcon,
  PhoneIcon,
  WhatsappIcon,
  RouteIcon,
  PrescriptionIcon,
  PrayerIcon,
  CategoryMedicineIcon,
  CategoryEquipmentIcon,
  CategoryVitaminsIcon,
  CategoryBabyIcon,
  AddressIcon,
} from "./icons";

type ViewMode = "map" | "nearby";
type GeoStatus = "idle" | "loading" | "allowed" | "denied" | "unsupported";
type LocationSource = "gps" | "manual" | null;
type PharmacyReportType = "wrong_number" | "closed" | "fake_stock";

type PharmacyResponse = {
  success: boolean;
  data?: PharmacyByProductItem[];
  error?: string;
};

type UserLocation = {
  lat: number;
  lng: number;
};

type YMapPlacemark = {
  events: {
    add: (eventName: string, handler: () => void) => void;
  };
};

type YMapEvent = {
  get: (key: string) => unknown;
};

type YMapInstance = {
  events: {
    add: (eventName: string, handler: (event: YMapEvent) => void) => void;
  };
  geoObjects: {
    add: (object: YMapPlacemark) => void;
  };
  behaviors: {
    disable: (behaviorName: string | string[]) => void;
    enable: (behaviorName: string | string[]) => void;
  };
  container: {
    fitToViewport: () => void;
  };
  destroy: () => void;
};

type YMapsApi = {
  ready: (callback: () => void) => void;
  Map: new (
    element: HTMLElement,
    state: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => YMapInstance;
  Placemark: new (
    coordinates: [number, number],
    properties: Record<string, string>,
    options?: Record<string, unknown>
  ) => YMapPlacemark;
};

declare global {
  interface Window {
    ymaps?: YMapsApi;
  }
}

const GU_DERMES_CENTER: UserLocation = { lat: 43.3517, lng: 46.1003 };
const ACTIVE_MAP_BEHAVIORS = ["drag", "scrollZoom", "multiTouch"];
const PASSIVE_MAP_BEHAVIORS = ["drag", "scrollZoom", "multiTouch"];
const NEARBY_LIST_INITIAL_LIMIT = 4;

const CATEGORY_LABELS = {
  medicine: "Лекарство",
  equipment: "Медтехника",
  vitamins: "Витамины",
  mother_and_baby: "Мать и дитя",
};

const STATUS_LABELS = {
  in_stock: "В наличии",
  likely_in_stock: "Вероятно в наличии",
  unknown: "Наличие неизвестно",
};

const STATUS_HINTS = {
  in_stock:
    "Данные по остатку обновляются из сети аптек. Перед выездом можно подтвердить наличие в WhatsApp.",
  likely_in_stock: "Данные из выгрузки. Уточните перед выездом.",
  unknown: "У малой аптеки нет онлайн-остатков. Лучше написать или позвонить.",
};

const REPORT_OPTIONS: Array<{ type: PharmacyReportType; label: string }> = [
  { type: "closed", label: "Аптека закрыта" },
  { type: "wrong_number", label: "Неверный номер" },
  { type: "fake_stock", label: "Препарата нет" },
];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function formatPrice(price?: number) {
  if (typeof price !== "number") {
    return "Цена уточняется";
  }

  return `от ${new Intl.NumberFormat("ru-RU").format(price)} ₽`;
}

function formatCompactPrice(price?: number) {
  if (typeof price !== "number") {
    return "Уточнить";
  }

  return `${new Intl.NumberFormat("ru-RU").format(price)} ₽`;
}

function formatDistance(distance: number | null) {
  if (distance === null) {
    return "Без расстояния";
  }

  if (distance < 1000) {
    return `${distance} м`;
  }

  return `${(distance / 1000).toFixed(1).replace(".", ",")} км`;
}

function getTodaySchedule(workingHours: PharmacyByProductItem["working_hours"]) {
  if (!workingHours || typeof workingHours !== "object" || Array.isArray(workingHours)) {
    return "График уточняется";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    weekday: "short",
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const dayKey = DAY_KEYS[WEEKDAY_TO_INDEX[weekday] ?? 1];
  const daySchedule = (workingHours as Record<string, unknown>)[dayKey];

  return typeof daySchedule === "string" ? daySchedule : "График уточняется";
}

function formatPhoneHref(phone: string | null) {
  if (!phone) {
    return "";
  }

  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function formatWhatsappHref(phone: string | null, productName: string) {
  if (!phone) {
    return "";
  }

  const digits = phone.replace(/\D/g, "");
  const text = `Здравствуйте! У вас есть в наличии ${productName}? Я нашел вас через сервис GotMeds`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function formatRouteHref(pharmacy: PharmacyByProductItem) {
  const { lat, lng } = pharmacy.coordinates;
  const params = new URLSearchParams({
    mode: "routes",
    rtext: `~${lat},${lng}`,
    rtt: "auto",
    ll: `${lng},${lat}`,
    z: "16",
  });

  return `https://yandex.ru/maps/?${params.toString()}`;
}

function getCategoryIcon(category: string) {
  const props = { className: styles.categoryIcon, "aria-hidden": true };
  switch (category) {
    case "medicine":
      return <CategoryMedicineIcon {...props} />;
    case "equipment":
      return <CategoryEquipmentIcon {...props} />;
    case "vitamins":
      return <CategoryVitaminsIcon {...props} />;
    case "mother_and_baby":
      return <CategoryBabyIcon {...props} />;
    default:
      return null;
  }
}

function getMarkerClass(pharmacy: PharmacyByProductItem, selected: boolean) {
  const classNames = [styles.mapMarker, styles[`marker_${pharmacy.status}`]];

  if (!pharmacy.is_open_now) {
    classNames.push(styles.markerClosed);
  }

  if (selected) {
    classNames.push(styles.mapMarkerSelected);
  }

  return classNames.join(" ");
}

function getYandexPreset(pharmacy: PharmacyByProductItem) {
  if (!pharmacy.is_open_now) {
    return "islands#grayDotIcon";
  }

  if (pharmacy.status === "in_stock") {
    return "islands#greenDotIcon";
  }

  if (pharmacy.status === "likely_in_stock") {
    return "islands#yellowDotIcon";
  }

  return "islands#grayDotIcon";
}

function getCardStatusLabel(pharmacy: PharmacyByProductItem) {
  if (pharmacy.status === "unknown") {
    return "Наличие неизвестно";
  }

  if (pharmacy.status === "likely_in_stock") {
    return "Вероятно · уточнить";
  }

  return pharmacy.is_open_now ? "В наличии · открыто" : "В наличии · закрыто";
}

function getMapBounds(pharmacies: PharmacyByProductItem[], userLocation: UserLocation | null) {
  const points = [
    ...pharmacies.map((pharmacy) => pharmacy.coordinates),
    ...(userLocation ? [userLocation] : [GU_DERMES_CENTER]),
  ];
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function getPointPosition(
  point: UserLocation,
  bounds: ReturnType<typeof getMapBounds>
) {
  const latRange = bounds.maxLat - bounds.minLat || 0.01;
  const lngRange = bounds.maxLng - bounds.minLng || 0.01;
  const padding = 12;
  const width = 100 - padding * 2;

  return {
    left: padding + ((point.lng - bounds.minLng) / lngRange) * width,
    top: padding + (1 - (point.lat - bounds.minLat) / latRange) * width,
  };
}

function getPointFromMapPosition(
  position: { x: number; y: number },
  bounds: ReturnType<typeof getMapBounds>
) {
  const latRange = bounds.maxLat - bounds.minLat || 0.01;
  const lngRange = bounds.maxLng - bounds.minLng || 0.01;
  const padding = 12;
  const width = 100 - padding * 2;
  const normalizedX = Math.min(1, Math.max(0, (position.x - padding) / width));
  const normalizedY = Math.min(1, Math.max(0, (position.y - padding) / width));

  return {
    lat: bounds.maxLat - normalizedY * latRange,
    lng: bounds.minLng + normalizedX * lngRange,
  };
}

function getMapCenter(
  pharmacies: PharmacyByProductItem[],
  userLocation: UserLocation | null
): [number, number] {
  if (userLocation) {
    return [userLocation.lat, userLocation.lng];
  }

  if (pharmacies[0]) {
    return [pharmacies[0].coordinates.lat, pharmacies[0].coordinates.lng];
  }

  return [GU_DERMES_CENTER.lat, GU_DERMES_CENTER.lng];
}

function getYandexScriptSrc(apiKey?: string) {
  const params = new URLSearchParams({ lang: "ru_RU" });

  if (apiKey?.trim()) {
    params.set("apikey", apiKey.trim());
  }

  return `https://api-maps.yandex.ru/2.1/?${params.toString()}`;
}

function isFridayPrayerTime(pharmacies: PharmacyByProductItem[]) {
  if (!pharmacies.some((pharmacy) => pharmacy.tier === "1")) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;

  return weekday === "Fri" && hour >= 12 && hour < 14;
}

type MapExperienceProps = {
  query: string;
  initialProduct: ProductDetails | null;
  initialPharmacies: PharmacyByProductItem[];
  initialError: string;
  initialRestrictedSearch: boolean;
};

export function MapExperience(props: MapExperienceProps) {
  const mapKey = [
    props.query,
    props.initialProduct?.id ?? "no-product",
    props.initialRestrictedSearch ? "restricted" : "available",
  ].join(":");

  return <MapExperienceContent key={mapKey} {...props} />;
}

function MapExperienceContent({
  query,
  initialProduct,
  initialPharmacies,
  initialError,
  initialRestrictedSearch,
}: MapExperienceProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(query);
  const [product] = useState(initialProduct);
  const [pharmacies, setPharmacies] = useState(initialPharmacies);
  const [mode, setMode] = useState<ViewMode>("map");
  const [openNow, setOpenNow] = useState(true);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const manualLocationPickedRef = useRef(false);
  const handlePharmacySelect = useCallback((id: string) => {
    setSelectedId((currentId) => (currentId === id ? null : id));
  }, []);
  const closePharmacySheet = useCallback(() => {
    setSelectedId(null);
  }, []);
  const startLocationPick = useCallback(() => {
    setSelectedId(null);
    setIsPickingLocation(true);
  }, []);
  const cancelLocationPick = useCallback(() => {
    setIsPickingLocation(false);
  }, []);
  const handleManualLocationPick = useCallback((location: UserLocation) => {
    manualLocationPickedRef.current = true;
    setUserLocation(location);
    setLocationSource("manual");
    setGeoStatus((currentStatus) =>
      currentStatus === "idle" || currentStatus === "loading"
        ? "denied"
        : currentStatus
    );
    setSelectedId(null);
    setIsPickingLocation(false);
    setMode("nearby");
  }, []);
  const selectedPharmacy = selectedId
    ? pharmacies.find((pharmacy) => pharmacy.pharmacy_id === selectedId)
    : null;

  useEffect(() => {
    if (!product) {
      return;
    }

    if (!("geolocation" in navigator)) {
      window.setTimeout(() => setGeoStatus("unsupported"), 0);
      return;
    }

    const loadingTimeoutId = window.setTimeout(() => setGeoStatus("loading"), 0);
    const gpsFallbackTimeoutId = window.setTimeout(() => {
      setGeoStatus((currentStatus) =>
        currentStatus === "loading" ? "denied" : currentStatus
      );
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(gpsFallbackTimeoutId);

        if (!manualLocationPickedRef.current) {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationSource("gps");
        }

        setIsPickingLocation(false);
        setGeoStatus("allowed");
      },
      () => {
        window.clearTimeout(gpsFallbackTimeoutId);
        setGeoStatus("denied");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 300000,
        timeout: 7000,
      }
    );

    return () => {
      window.clearTimeout(loadingTimeoutId);
      window.clearTimeout(gpsFallbackTimeoutId);
    };
  }, [product]);

  useEffect(() => {
    if (!product || geoStatus === "idle" || geoStatus === "loading") {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      productId: product.id,
      openNow: String(openNow),
    });

    if (userLocation) {
      params.set("lat", String(userLocation.lat));
      params.set("lng", String(userLocation.lng));
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setErrorMessage("");

      fetch(`/api/pharmacies?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as PharmacyResponse;

          if (!response.ok || !payload.success) {
            throw new Error(payload.error || "Не удалось загрузить аптеки");
          }

          setPharmacies(payload.data ?? []);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setPharmacies([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить аптеки. Попробуйте позже."
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [geoStatus, openNow, product, userLocation]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = searchQuery.trim();

    if (!nextQuery) {
      router.push("/");
      return;
    }

    router.push(`/map?q=${encodeURIComponent(nextQuery)}`);
  };

  const shouldShowLocationControl =
    isPickingLocation ||
    geoStatus === "loading" ||
    geoStatus === "denied" ||
    geoStatus === "unsupported" ||
    locationSource === "manual";
  const locationStatusLabel = isPickingLocation
    ? "Выберите место на карте"
    : locationSource === "manual"
      ? "Местоположение выбрано"
      : geoStatus === "loading"
        ? "Определяем GPS"
        : "Местоположение не указано";

  if (initialRestrictedSearch) {
    return (
      <main className={styles.shell}>
        <header className={styles.searchHeader}>
          <BrandMark />

          <form className={styles.searchForm} role="search" onSubmit={handleSearchSubmit}>
            <label className={styles.searchLabel} htmlFor="map-search-restricted">
              Поиск
            </label>
            <div className={styles.searchInputWrapper}>
              <SearchIcon className={styles.searchFieldIcon} />
              <input
                id="map-search-restricted"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Введите препарат"
                autoComplete="off"
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={() => setSearchQuery("")}
                  aria-label="Очистить поиск"
                >
                  <ClearIcon />
                </button>
              )}
            </div>
            <button className={styles.searchButton} type="submit">
              Найти
            </button>
          </form>
        </header>

        <section className={styles.restrictedMapState} role="status">
          <span className={styles.restrictedMapIcon} aria-hidden="true" />
          <span>
            Поиск данного препарата ограничен сервисом GotMeds согласно правилам
            платформы
          </span>
        </section>

        <p className={styles.disclaimer}>
          Сервис носит информационный характер. Имеются противопоказания. Не
          является публичной офертой
        </p>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.searchHeader}>
        <BrandMark />

        <form className={styles.searchForm} role="search" onSubmit={handleSearchSubmit}>
          <label className={styles.searchLabel} htmlFor="map-search">
            Поиск
          </label>
          <div className={styles.searchInputWrapper}>
            <SearchIcon className={styles.searchFieldIcon} />
            <input
              id="map-search"
              className={styles.searchInput}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Введите препарат"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchButton}
                onClick={() => setSearchQuery("")}
                aria-label="Очистить поиск"
              >
                <ClearIcon />
              </button>
            )}
          </div>
          <button className={styles.searchButton} type="submit">
            Найти
          </button>
        </form>
      </header>

      <section className={styles.resultPanel} aria-label="Сводка поиска">
        <div className={styles.resultTopRow}>
          {product ? (
            <section className={styles.productStrip} aria-label="Выбранный препарат">
              <div className={styles.productInfoWrapper}>
                <div className={styles.categoryBadge}>
                  {getCategoryIcon(product.category)}
                  <span>{CATEGORY_LABELS[product.category]}</span>
                </div>
                <h1>{product.name}</h1>
              </div>
              <strong className={styles.priceTag}>{formatPrice(product.price_estimate)}</strong>
            </section>
          ) : null}

          <label className={styles.openNowToggle}>
            <ClockIcon className={styles.toggleClockIcon} />
            <span>Открыто сейчас</span>
            <span className={styles.switchSlider}>
              <input
                type="checkbox"
                checked={openNow}
                onChange={(event) => setOpenNow(event.target.checked)}
              />
              <span className={styles.switchKnob} />
            </span>
          </label>
        </div>

        <div className={styles.noticeStack}>
          {product?.is_prescription ? (
            <div className={styles.prescriptionAlert} role="note">
              <PrescriptionIcon className={styles.alertIcon} />
              <span>Отпускается строго по рецепту врача</span>
            </div>
          ) : null}

          {isFridayPrayerTime(pharmacies) ? (
            <div className={styles.localWarning} role="note">
              <PrayerIcon className={styles.alertIcon} />
              <span>Может быть закрыто на пятничную молитву. Позвоните перед выездом</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.mapModeBar} aria-label="Режим карты">
        <div className={styles.segmentedControl}>
          <button
            className={mode === "map" ? styles.segmentActive : ""}
            type="button"
            onClick={() => setMode("map")}
            aria-pressed={mode === "map"}
          >
            <MapIcon className={styles.segmentIcon} />
            <span>Карта</span>
          </button>
          <button
            className={mode === "nearby" ? styles.segmentActive : ""}
            type="button"
            onClick={() => setMode("nearby")}
            aria-pressed={mode === "nearby"}
          >
            <ListIcon className={styles.segmentIcon} />
            <span>Аптеки рядом</span>
          </button>
        </div>

        <div className={styles.locationSlot}>
          {shouldShowLocationControl ? (
            <div className={styles.locationControl} role="status">
              <LocationIcon className={`${styles.locationIcon} ${geoStatus === "loading" ? styles.locationPulse : ""}`} />
              <span>{locationStatusLabel}</span>
              {geoStatus !== "loading" ? (
                <button
                  type="button"
                  className={styles.locationButton}
                  onClick={isPickingLocation ? cancelLocationPick : startLocationPick}
                >
                  {isPickingLocation
                    ? "Отмена"
                    : locationSource === "manual"
                      ? "Изменить место"
                      : "Указать местоположение"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section
        className={`${styles.contentGrid} ${
          mode === "nearby" ? styles.contentGridNearbyMode : styles.contentGridMapMode
        }`}
      >
        <div className={mode === "map" ? styles.mapColumn : styles.mapColumnHidden}>
          <MapCanvas
            pharmacies={pharmacies}
            selectedId={selectedId}
            userLocation={userLocation}
            viewMode={mode}
            onSelect={handlePharmacySelect}
            onPickLocation={handleManualLocationPick}
            isPickingLocation={isPickingLocation}
            locationSource={locationSource}
          />
        </div>

        <div className={mode === "nearby" ? styles.listColumn : styles.listColumnCompact}>
          {selectedPharmacy && product && mode === "nearby" ? (
            <PharmacySheet
              pharmacy={selectedPharmacy}
              productName={product.name}
              productPriceEstimate={product.price_estimate}
              placement="inline"
              onClose={closePharmacySheet}
            />
          ) : (
            <PharmacyList
              productName={product?.name ?? query}
              pharmacies={pharmacies}
              productPriceEstimate={product?.price_estimate}
              isLoading={isLoading && pharmacies.length === 0}
              errorMessage={errorMessage}
              hasProduct={Boolean(product)}
              hasLocation={Boolean(userLocation)}
              selectedId={selectedId}
              onSelect={handlePharmacySelect}
            />
          )}
        </div>
      </section>

      {selectedPharmacy && product && mode === "map" ? (
        <PharmacySheet
          pharmacy={selectedPharmacy}
          productName={product.name}
          productPriceEstimate={product.price_estimate}
          placement="floating"
          onClose={closePharmacySheet}
        />
      ) : null}

      <p className={styles.disclaimer}>
        Сервис носит информационный характер. Имеются противопоказания. Не
        является публичной офертой
      </p>
    </main>
  );
}

function MapCanvas({
  pharmacies,
  selectedId,
  userLocation,
  viewMode,
  onSelect,
  onPickLocation,
  isPickingLocation,
  locationSource,
}: {
  pharmacies: PharmacyByProductItem[];
  selectedId: string | null;
  userLocation: UserLocation | null;
  viewMode: ViewMode;
  onSelect: (id: string) => void;
  onPickLocation: (location: UserLocation) => void;
  isPickingLocation: boolean;
  locationSource: LocationSource;
}) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const yandexScriptSrc = getYandexScriptSrc(apiKey);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [isMapActive, setIsMapActive] = useState(false);
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<YMapInstance | null>(null);
  const activationPointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const blockActivationClickRef = useRef(false);
  const mapBehaviorStateRef = useRef({
    isMapActive,
    isPickingLocation,
    viewMode,
  });
  const isMapLocked = viewMode === "nearby" && !isMapActive && !isPickingLocation;
  const selectedPharmacy = selectedId
    ? pharmacies.find((pharmacy) => pharmacy.pharmacy_id === selectedId)
    : null;
  const center = useMemo(
    () => getMapCenter(pharmacies, userLocation),
    [pharmacies, userLocation]
  );
  const markYandexScriptReady = useCallback(() => {
    if (window.ymaps) {
      setScriptReady(true);
      setScriptFailed(false);
    }
  }, []);

  const applyMapBehaviors = useCallback(
    (map = mapInstanceRef.current) => {
      if (!map) {
        return;
      }

      const behaviorState = mapBehaviorStateRef.current;

      if (
        behaviorState.isMapActive ||
        behaviorState.isPickingLocation ||
        behaviorState.viewMode === "map"
      ) {
        map.behaviors.enable(ACTIVE_MAP_BEHAVIORS);
        return;
      }

      if (behaviorState.viewMode === "nearby") {
        map.behaviors.disable(PASSIVE_MAP_BEHAVIORS);
        return;
      }

      map.behaviors.enable("drag");
      map.behaviors.disable("scrollZoom");
    },
    []
  );
  const activateMapInteraction = useCallback(() => {
    mapShellRef.current?.focus();
    setIsMapActive(true);
  }, []);
  const handleActivationPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      blockActivationClickRef.current = false;
      activationPointerRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
    },
    []
  );
  const handleActivationPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const pointerState = activationPointerRef.current;

      if (!pointerState || pointerState.pointerId !== event.pointerId) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - pointerState.x,
        event.clientY - pointerState.y
      );

      if (distance > 8) {
        pointerState.moved = true;
      }
    },
    []
  );
  const resetActivationPointer = useCallback(() => {
    activationPointerRef.current = null;
    blockActivationClickRef.current = true;
  }, []);
  const handleActivationClick = useCallback(() => {
    const pointerState = activationPointerRef.current;
    const shouldSkipActivation =
      blockActivationClickRef.current || Boolean(pointerState?.moved);

    if (!shouldSkipActivation) {
      activateMapInteraction();
    }

    activationPointerRef.current = null;
    blockActivationClickRef.current = false;
  }, [activateMapInteraction]);
  useEffect(() => {
    if (viewMode !== "nearby" || !isMapActive || isPickingLocation) {
      return undefined;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (mapShellRef.current?.contains(target)) {
        return;
      }

      setIsMapActive(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    };
  }, [isMapActive, isPickingLocation, viewMode]);

  useEffect(() => {
    if (viewMode === "nearby" && !isPickingLocation) {
      const timeoutId = window.setTimeout(() => setIsMapActive(false), 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [isPickingLocation, viewMode]);

  useEffect(
    () => {
      mapBehaviorStateRef.current = {
        isMapActive,
        isPickingLocation,
        viewMode,
      };
      applyMapBehaviors();
    },
    [applyMapBehaviors, isMapActive, isPickingLocation, viewMode]
  );

  useEffect(() => {
    if (!scriptReady || !window.ymaps || !mapNodeRef.current) {
      return;
    }

    let disposed = false;

    window.ymaps.ready(() => {
      if (disposed || !window.ymaps || !mapNodeRef.current) {
        return;
      }

      mapInstanceRef.current?.destroy();

      const map = new window.ymaps.Map(
        mapNodeRef.current,
        {
          center,
          zoom: 14,
          controls: ["zoomControl", "geolocationControl"],
        },
        {
          suppressMapOpenBlock: true,
        }
      );

      pharmacies.forEach((pharmacy) => {
        const placemark = new window.ymaps!.Placemark(
          [pharmacy.coordinates.lat, pharmacy.coordinates.lng],
          {
            hintContent: pharmacy.name,
            balloonContent: `${pharmacy.name}, ${pharmacy.address}`,
          },
          {
            preset: getYandexPreset(pharmacy),
          }
        );

        placemark.events.add("click", () => {
          if (isPickingLocation) {
            onPickLocation(pharmacy.coordinates);
            return;
          }

          onSelect(pharmacy.pharmacy_id);
        });
        map.geoObjects.add(placemark);
      });

      if (isPickingLocation) {
        map.events.add("click", (event) => {
          const coords = event.get("coords");

          if (Array.isArray(coords) && coords.length >= 2) {
            onPickLocation({ lat: Number(coords[0]), lng: Number(coords[1]) });
          }
        });
      }

      if (userLocation) {
        const userPlacemark = new window.ymaps.Placemark(
          [userLocation.lat, userLocation.lng],
          {
            hintContent:
              locationSource === "manual" ? "Выбранное место" : "Вы здесь",
          },
          {
            preset: "islands#blueCircleDotIcon",
          }
        );
        map.geoObjects.add(userPlacemark);
      }

      mapInstanceRef.current = map;
      applyMapBehaviors(map);
      map.container.fitToViewport();
    });

    return () => {
      disposed = true;
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
    };
  }, [
    center,
    applyMapBehaviors,
    isPickingLocation,
    locationSource,
    onPickLocation,
    onSelect,
    pharmacies,
    scriptReady,
    userLocation,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const syncMapBehaviors = () => applyMapBehaviors(map);

    syncMapBehaviors();
    mediaQuery.addEventListener("change", syncMapBehaviors);

    return () => {
      mediaQuery.removeEventListener("change", syncMapBehaviors);
    };
  }, [applyMapBehaviors, scriptReady]);

  useEffect(() => {
    const mapNode = mapNodeRef.current;

    if (!mapNode) {
      return;
    }

    let frameId = 0;
    const fitMap = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        mapInstanceRef.current?.container.fitToViewport();
      });
    };

    fitMap();

    if (!("ResizeObserver" in window)) {
      return () => window.cancelAnimationFrame(frameId);
    }

    const resizeObserver = new ResizeObserver(fitMap);
    resizeObserver.observe(mapNode);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [viewMode]);

  useEffect(() => {
    const timeoutId = window.setTimeout(markYandexScriptReady, 0);

    return () => window.clearTimeout(timeoutId);
  }, [markYandexScriptReady]);

  if (scriptFailed) {
    return (
      <SchematicMap
        pharmacies={pharmacies}
        selectedId={selectedId}
        userLocation={userLocation}
        onSelect={onSelect}
        onPickLocation={onPickLocation}
        isPickingLocation={isPickingLocation}
        locationSource={locationSource}
      />
    );
  }

  return (
    <div
      className={`${styles.providerMapShell} ${
        isPickingLocation ? styles.providerMapShellPicking : ""
      } ${isMapActive ? styles.providerMapShellActive : ""}`}
      ref={mapShellRef}
      tabIndex={0}
    >
      <Script
        id="yandex-maps-api"
        src={yandexScriptSrc}
        strategy="afterInteractive"
        onReady={markYandexScriptReady}
        onLoad={markYandexScriptReady}
        onError={() => setScriptFailed(true)}
      />
      <div className={styles.providerMap} ref={mapNodeRef} />
      <MapLegend />
      {isMapLocked ? (
        <button
          className={styles.mapInteractionOverlay}
          type="button"
          aria-label="Активировать карту"
          onPointerDown={handleActivationPointerDown}
          onPointerMove={handleActivationPointerMove}
          onPointerCancel={resetActivationPointer}
          onClick={handleActivationClick}
        />
      ) : null}
      {isPickingLocation ? (
        <div className={styles.mapPickHint}>Нажмите на карту, чтобы выбрать место</div>
      ) : null}
      {selectedPharmacy ? (
        <div className={styles.providerSelectedHint} data-pharmacy-trigger="true">
          <span>{STATUS_LABELS[selectedPharmacy.status]}</span>
          <strong>{selectedPharmacy.name}</strong>
          <small>
            {selectedPharmacy.distance_meters !== null
              ? `${formatDistance(selectedPharmacy.distance_meters)} от вас`
              : "Расстояние уточняется"}
          </small>
        </div>
      ) : null}
      {!scriptReady ? <div className={styles.mapLoading}>Загрузка Яндекс.Карт</div> : null}
    </div>
  );
}

function MapLegend() {
  return (
    <div className={styles.mapLegend} aria-hidden="true">
      <span className={styles.mapLegendCity}>Гудермес</span>
      <div className={styles.mapLegendPill}>
        <span className={styles.mapLegendItem}>
          <span className={`${styles.mapLegendDot} ${styles.legendDotInStock}`} />
          В наличии
        </span>
        <span className={styles.mapLegendItem}>
          <span className={`${styles.mapLegendDot} ${styles.legendDotLikely}`} />
          Вероятно
        </span>
        <span className={styles.mapLegendItem}>
          <span className={`${styles.mapLegendDot} ${styles.legendDotUnknown}`} />
          Неизвестно
        </span>
      </div>
    </div>
  );
}

function MapSelectedPreview({
  pharmacy,
  bounds,
}: {
  pharmacy: PharmacyByProductItem;
  bounds: ReturnType<typeof getMapBounds>;
}) {
  const position = getPointPosition(pharmacy.coordinates, bounds);
  const left = Math.min(position.left + 2, 78);
  const top = Math.max(position.top - 6, 14);

  return (
    <div
      className={styles.mapSelectedPreview}
      style={{
        left: `${left}%`,
        top: `${top}%`,
      }}
      data-pharmacy-trigger="true"
    >
      <span>{STATUS_LABELS[pharmacy.status]}</span>
      <strong>{pharmacy.name}</strong>
      <small>
        {pharmacy.distance_meters !== null
          ? `${formatDistance(pharmacy.distance_meters)} от вас`
          : "Расстояние уточняется"}
      </small>
    </div>
  );
}

function SchematicMap({
  pharmacies,
  selectedId,
  userLocation,
  onSelect,
  onPickLocation,
  isPickingLocation,
  locationSource,
}: {
  pharmacies: PharmacyByProductItem[];
  selectedId: string | null;
  userLocation: UserLocation | null;
  onSelect: (id: string) => void;
  onPickLocation: (location: UserLocation) => void;
  isPickingLocation: boolean;
  locationSource: LocationSource;
}) {
  const bounds = useMemo(
    () => getMapBounds(pharmacies, userLocation),
    [pharmacies, userLocation]
  );

  return (
    <div
      className={`${styles.schematicMap} ${
        isPickingLocation ? styles.schematicMapPicking : ""
      }`}
      aria-label="Карта аптек"
      onPointerDown={(event) => {
        if (!isPickingLocation || event.target !== event.currentTarget) {
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const position = {
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        };

        onPickLocation(getPointFromMapPosition(position, bounds));
      }}
    >
      {isPickingLocation ? (
        <div className={styles.mapPickHint}>Нажмите на карту, чтобы выбрать место</div>
      ) : null}

      <MapLegend />

      {pharmacies.map((pharmacy) => {
        const position = getPointPosition(pharmacy.coordinates, bounds);

        return (
          <button
            className={getMarkerClass(pharmacy, selectedId === pharmacy.pharmacy_id)}
            key={pharmacy.pharmacy_id}
            type="button"
            style={{
              left: `${position.left}%`,
              top: `${position.top}%`,
            }}
            aria-label={`${pharmacy.name}: ${STATUS_LABELS[pharmacy.status]}`}
            data-pharmacy-trigger="true"
            onClick={(event) => {
              if (isPickingLocation) {
                event.stopPropagation();
                onPickLocation(pharmacy.coordinates);
                return;
              }

              onSelect(pharmacy.pharmacy_id);
            }}
          />
        );
      })}

      {userLocation ? (
        <span
          className={styles.userMarker}
          style={{
            left: `${getPointPosition(userLocation, bounds).left}%`,
            top: `${getPointPosition(userLocation, bounds).top}%`,
          }}
          aria-label={locationSource === "manual" ? "Выбранное место" : "Ваше местоположение"}
        />
      ) : null}

      {selectedId ? (
        pharmacies
          .filter((pharmacy) => pharmacy.pharmacy_id === selectedId)
          .map((pharmacy) => (
            <MapSelectedPreview
              key={`preview-${pharmacy.pharmacy_id}`}
              pharmacy={pharmacy}
              bounds={bounds}
            />
          ))
      ) : null}
    </div>
  );
}

function PharmacyList({
  productName,
  pharmacies,
  productPriceEstimate,
  isLoading,
  errorMessage,
  hasProduct,
  hasLocation,
  selectedId,
  onSelect,
}: {
  productName: string;
  pharmacies: PharmacyByProductItem[];
  productPriceEstimate?: number;
  isLoading: boolean;
  errorMessage: string;
  hasProduct: boolean;
  hasLocation: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const pharmacyListKey = pharmacies
    .map((pharmacy) => pharmacy.pharmacy_id)
    .join("|");
  const [expandedListKey, setExpandedListKey] = useState<string | null>(null);
  const isListExpanded = expandedListKey === pharmacyListKey;
  const shouldLimitList = pharmacies.length > NEARBY_LIST_INITIAL_LIMIT;
  const visiblePharmacies =
    shouldLimitList && !isListExpanded
      ? pharmacies.slice(0, NEARBY_LIST_INITIAL_LIMIT)
      : pharmacies;
  const hiddenPharmaciesCount = pharmacies.length - visiblePharmacies.length;
  const visibleNearbyCount = visiblePharmacies.filter(
    (pharmacy) => pharmacy.distance_meters !== null
  ).length;

  const listHeader = (
    <div className={styles.listPanelHeader}>
      <div>
        <span>Аптеки рядом</span>
        <strong>{visibleNearbyCount || visiblePharmacies.length}</strong>
      </div>
      <span className={styles.listSortBadge}>По расстоянию</span>
    </div>
  );

  if (isLoading) {
    return (
      <section className={styles.pharmacyListPanel} aria-label="Аптеки рядом">
        {listHeader}
        <div className={styles.listSkeleton} aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (!hasProduct) {
    return (
      <section className={styles.pharmacyListPanel} aria-label="Аптеки рядом">
        {listHeader}
        <div className={styles.emptyState} role="status">
          <strong>Препарат не найден</strong>
          <span>Попробуйте изменить запрос или вернуться к поиску.</span>
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className={styles.pharmacyListPanel} aria-label="Аптеки рядом">
        {listHeader}
        <div className={styles.emptyState} role="status">
          <strong>Аптеки временно недоступны</strong>
          <span>{errorMessage}</span>
        </div>
      </section>
    );
  }

  if (pharmacies.length === 0) {
    return (
      <section className={styles.pharmacyListPanel} aria-label="Аптеки рядом">
        {listHeader}
        <div className={styles.emptyState} role="status">
          <strong>Сейчас нет в наличии в Гудермесе</strong>
          <span>
            Можно связаться с дежурной аптекой и уточнить заказ препарата
            {productName ? ` ${productName}` : ""}.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.pharmacyListPanel} aria-label="Аптеки рядом">
      {listHeader}

      {!hasLocation ? (
        <div className={styles.locationListHint} role="note">
          Укажите местоположение, чтобы отсортировать аптеки по расстоянию.
        </div>
      ) : null}

      <ul className={styles.pharmacyList} aria-label="Аптеки">
        {visiblePharmacies.map((pharmacy) => (
          <li key={pharmacy.pharmacy_id}>
            <button
              className={`${styles.pharmacyCard} ${
                selectedId === pharmacy.pharmacy_id ? styles.pharmacyCardSelected : ""
              } ${styles[`card_${pharmacy.status}`]}`}
              type="button"
              data-pharmacy-trigger="true"
              onClick={() => onSelect(pharmacy.pharmacy_id)}
            >
              <span className={styles.cardTopLine}>
                <strong>{pharmacy.name}</strong>
                {pharmacy.distance_meters !== null ? (
                  <span className={styles.distanceText}>
                    <LocationIcon className={styles.cardDistanceIcon} />
                    {formatDistance(pharmacy.distance_meters)}
                  </span>
                ) : null}
              </span>
              <span className={styles.addressText}>
                <AddressIcon className={styles.cardAddressIcon} />
                <span>{pharmacy.address}</span>
              </span>
              <span className={styles.statusLine}>
                <span className={`${styles.cardStatusText} ${styles[`statusText_${pharmacy.status}`]}`}>
                  {getCardStatusLabel(pharmacy)}
                </span>
                <span className={styles.cardPriceText}>
                  {pharmacy.status === "unknown"
                    ? "Узнать цену"
                    : formatPrice(productPriceEstimate)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {shouldLimitList ? (
        <button
          type="button"
          className={styles.showAllPharmaciesButton}
          aria-expanded={isListExpanded}
          onClick={() =>
            setExpandedListKey((currentKey) =>
              currentKey === pharmacyListKey ? null : pharmacyListKey
            )
          }
        >
          <span>
            {isListExpanded ? "Показать 4 ближайшие" : "Показать все аптеки"}
          </span>
          {!isListExpanded ? <small>Еще {hiddenPharmaciesCount}</small> : null}
        </button>
      ) : null}
    </section>
  );
}

function PharmacySheet({
  pharmacy,
  productName,
  productPriceEstimate,
  placement,
  onClose,
}: {
  pharmacy: PharmacyByProductItem;
  productName: string;
  productPriceEstimate?: number;
  placement: "floating" | "inline";
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const whatsappHref = formatWhatsappHref(pharmacy.whatsapp, productName);
  const phoneHref = formatPhoneHref(pharmacy.phone);
  const routeHref = formatRouteHref(pharmacy);
  const [isReportPanelOpen, setIsReportPanelOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");
  const [isReportPending, startReportTransition] = useTransition();

  const handleReportSubmit = (reportType: PharmacyReportType) => {
    setReportMessage("");
    setReportError("");

    startReportTransition(async () => {
      const result = await submitPharmacyReport(pharmacy.pharmacy_id, reportType);

      if (!result.success) {
        setReportError(result.error ?? "Не удалось отправить жалобу.");
        return;
      }

      setIsReportPanelOpen(false);
      setReportMessage("Спасибо, модератор проверит информацию.");
    });
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (sheetRef.current?.contains(target)) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest("[data-pharmacy-trigger='true']")
      ) {
        return;
      }

      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [onClose]);

  // Делим адрес на две строки для компактной карточки аптеки.
  const addressParts = pharmacy.address.split(",");
  const mainAddress = addressParts[0]?.trim() || pharmacy.address;
  const secondaryAddress = addressParts.slice(1).join(",").trim() || "Чеченская Республика";

  // Подпись зависит от уровня достоверности остатка.
  const getAvailabilityInfo = () => {
    switch (pharmacy.status) {
      case "in_stock":
        return { label: "В наличии", sub: "остаток обновлен сегодня" };
      case "likely_in_stock":
        return { label: "Вероятно в наличии", sub: "уточните перед выездом" };
      default:
        return { label: "Наличие неизвестно", sub: "напишите в аптеку" };
    }
  };
  const availability = getAvailabilityInfo();

  return (
    <aside
      className={`${styles.sheet} ${
        placement === "inline" ? styles.sheetInline : styles.sheetFloating
      }`}
      ref={sheetRef}
      aria-label="Карточка аптеки"
    >
      <div className={styles.sheetHeader}>
        <div className={styles.sheetTierBadge}>
          <span className={styles.sheetTier}>
            {pharmacy.tier === "Chain"
              ? "Сетевая аптека"
              : pharmacy.tier === "2"
                ? "Крупная частная аптека"
                : "Малая аптека"}
          </span>
        </div>
        <span className={styles.sheetHeaderDistance}>
          {formatDistance(pharmacy.distance_meters)}
        </span>
      </div>

      <h2 className={styles.sheetTitle}>{pharmacy.name}</h2>

      <div className={styles.sheetFacts}>
        <div className={styles.sheetFactItem}>
          <span className={`${styles.sheetFactIconCircle} ${styles.factCircle_address}`}>
            <AddressIcon className={styles.sheetFactIcon} />
          </span>
          <div className={styles.sheetFactTexts}>
            <strong>{mainAddress}</strong>
            <span>{secondaryAddress}</span>
          </div>
        </div>

        <div className={styles.sheetFactItem}>
          <span className={`${styles.sheetFactIconCircle} ${styles.factCircle_time}`}>
            <ClockIcon className={styles.sheetFactIcon} />
          </span>
          <div className={styles.sheetFactTexts}>
            <strong>{pharmacy.is_24_7 ? "Круглосуточно" : getTodaySchedule(pharmacy.working_hours)}</strong>
            <span className={pharmacy.is_open_now ? styles.textSuccess : styles.textDanger}>
              {pharmacy.is_open_now ? "Открыто сейчас" : "Сейчас закрыто"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.availabilityCard}>
        <div className={styles.availabilityLeft}>
          <span className={`${styles.availabilityCheckCircle} ${styles[`availCircle_${pharmacy.status}`]}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className={styles.availabilityText}>
            <strong>{availability.label}</strong>
            <small>{availability.sub}</small>
          </span>
        </div>
        <span className={styles.availabilityRight}>
          {pharmacy.status === "unknown"
            ? "Уточнить"
            : formatCompactPrice(productPriceEstimate)}
        </span>
      </div>

      <p className={styles.statusHint}>{STATUS_HINTS[pharmacy.status]}</p>

      <div className={styles.sheetActionsContainer}>
        {whatsappHref ? (
          <a
            className={styles.sheetWhatsappButton}
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsappIcon className={styles.whatsappBtnIcon} />
            <span>{pharmacy.status === "unknown" ? "Узнать цену" : "Написать в WhatsApp"}</span>
          </a>
        ) : null}

        <div className={styles.sheetActionsBottomRow}>
          {phoneHref ? (
            <a href={phoneHref} className={styles.sheetPhoneButton}>
              <PhoneIcon className={styles.btnIcon} />
              <span>Позвонить</span>
            </a>
          ) : null}
          <a href={routeHref} target="_blank" rel="noreferrer" className={styles.sheetRouteButton}>
            <RouteIcon className={styles.btnIcon} />
            <span>Маршрут</span>
          </a>
        </div>
      </div>

      <div className={styles.reportBox}>
        <button
          className={styles.reportToggle}
          type="button"
          onClick={() => {
            setIsReportPanelOpen((isOpen) => !isOpen);
            setReportError("");
            setReportMessage("");
          }}
          aria-expanded={isReportPanelOpen}
        >
          Сообщить об ошибке
        </button>

        {isReportPanelOpen ? (
          <div className={styles.reportOptions} role="group" aria-label="Тип ошибки">
            {REPORT_OPTIONS.map((option) => (
              <button
                key={option.type}
                className={styles.reportOptionButton}
                type="button"
                disabled={isReportPending}
                onClick={() => handleReportSubmit(option.type)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {reportMessage ? (
          <p className={styles.reportSuccess} role="status">
            {reportMessage}
          </p>
        ) : null}
        {reportError ? (
          <p className={styles.reportError} role="alert">
            {reportError}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
