"use client";

import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PharmacyByProductItem,
  ProductDetails,
} from "@/lib/actions/products";
import styles from "./map-experience.module.css";

type ViewMode = "map" | "nearby";
type GeoStatus = "idle" | "loading" | "allowed" | "denied" | "unsupported";
type LocationSource = "gps" | "manual" | null;

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
  in_stock: "Данные по остатку обновляются из сети аптек.",
  likely_in_stock: "Данные из выгрузки. Уточните перед выездом.",
  unknown: "У малой аптеки нет онлайн-остатков. Лучше написать или позвонить.",
};

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

export function MapExperience({
  query,
  initialProduct,
  initialPharmacies,
  initialError,
  initialRestrictedSearch,
}: {
  query: string;
  initialProduct: ProductDetails | null;
  initialPharmacies: PharmacyByProductItem[];
  initialError: string;
  initialRestrictedSearch: boolean;
}) {
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
          <Link className={styles.logoMark} href="/" aria-label="GotMeds">
            <span className={styles.logoPartPrimary}>Got</span>
            <span className={styles.logoPartSecondary}>Meds</span>
          </Link>

          <form className={styles.searchForm} role="search" onSubmit={handleSearchSubmit}>
            <label className={styles.searchLabel} htmlFor="map-search">
              Поиск
            </label>
            <input
              id="map-search"
              className={styles.searchInput}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Введите препарат"
              autoComplete="off"
              spellCheck={false}
            />
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
        <Link className={styles.logoMark} href="/" aria-label="GotMeds">
          <span className={styles.logoPartPrimary}>Got</span>
          <span className={styles.logoPartSecondary}>Meds</span>
        </Link>

        <form className={styles.searchForm} role="search" onSubmit={handleSearchSubmit}>
          <label className={styles.searchLabel} htmlFor="map-search">
            Поиск
          </label>
          <input
            id="map-search"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Введите препарат"
            autoComplete="off"
            spellCheck={false}
          />
          <button className={styles.searchButton} type="submit">
            Найти
          </button>
        </form>
      </header>

      <section className={styles.resultPanel} aria-label="Сводка поиска">
        <div className={styles.resultTopRow}>
          {product ? (
            <section className={styles.productStrip} aria-label="Выбранный препарат">
              <div>
                <span>{CATEGORY_LABELS[product.category]}</span>
                <h1>{product.name}</h1>
              </div>
              <strong>{formatPrice(product.price_estimate)}</strong>
            </section>
          ) : null}

          <label className={styles.openNowToggle}>
            <input
              type="checkbox"
              checked={openNow}
              onChange={(event) => setOpenNow(event.target.checked)}
            />
            <span>Открыто сейчас</span>
          </label>
        </div>

        <div className={styles.noticeStack}>
          {product?.is_prescription ? (
            <div className={styles.prescriptionAlert} role="note">
              Отпускается строго по рецепту врача
            </div>
          ) : null}

          {isFridayPrayerTime(pharmacies) ? (
            <div className={styles.localWarning} role="note">
              Внимание! Сейчас время пятничной молитвы. Малые частные аптеки
              могут быть закрыты. Позвоните перед выездом
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
            Карта
          </button>
          <button
            className={mode === "nearby" ? styles.segmentActive : ""}
            type="button"
            onClick={() => setMode("nearby")}
            aria-pressed={mode === "nearby"}
          >
            Аптеки рядом
          </button>
        </div>

        <div className={styles.locationSlot}>
          {shouldShowLocationControl ? (
            <div className={styles.locationControl} role="status">
              <span>{locationStatusLabel}</span>
              {geoStatus !== "loading" ? (
                <button
                  type="button"
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
              placement="inline"
              onClose={closePharmacySheet}
            />
          ) : (
            <PharmacyList
              productName={product?.name ?? query}
              pharmacies={pharmacies}
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
      {!scriptReady ? <div className={styles.mapLoading}>Загрузка Яндекс.Карт</div> : null}
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
    </div>
  );
}

function PharmacyList({
  productName,
  pharmacies,
  isLoading,
  errorMessage,
  hasProduct,
  hasLocation,
  selectedId,
  onSelect,
}: {
  productName: string;
  pharmacies: PharmacyByProductItem[];
  isLoading: boolean;
  errorMessage: string;
  hasProduct: boolean;
  hasLocation: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className={styles.listSkeleton} aria-live="polite">
        {Array.from({ length: 3 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    );
  }

  if (!hasProduct) {
    return (
      <div className={styles.emptyState} role="status">
        <strong>Препарат не найден</strong>
        <span>Попробуйте изменить запрос или вернуться к поиску.</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={styles.emptyState} role="status">
        <strong>Аптеки временно недоступны</strong>
        <span>{errorMessage}</span>
      </div>
    );
  }

  if (pharmacies.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        <strong>Сейчас нет в наличии в Гудермесе</strong>
        <span>
          Можно связаться с дежурной аптекой и уточнить заказ препарата
          {productName ? ` ${productName}` : ""}.
        </span>
      </div>
    );
  }

  return (
    <>
      {!hasLocation ? (
        <div className={styles.locationListHint} role="note">
          Укажите местоположение, чтобы отсортировать аптеки по расстоянию.
        </div>
      ) : null}

      <ul className={styles.pharmacyList} aria-label="Аптеки">
        {pharmacies.map((pharmacy) => (
          <li key={pharmacy.pharmacy_id}>
            <button
              className={`${styles.pharmacyCard} ${
                selectedId === pharmacy.pharmacy_id ? styles.pharmacyCardSelected : ""
              }`}
              type="button"
              data-pharmacy-trigger="true"
              onClick={() => onSelect(pharmacy.pharmacy_id)}
            >
              <span className={styles.cardTopLine}>
                <strong>{pharmacy.name}</strong>
                <span className={styles.distanceText}>
                  {formatDistance(pharmacy.distance_meters)}
                </span>
              </span>
              <span className={styles.addressText}>{pharmacy.address}</span>
              <span className={styles.statusLine}>
                <span className={`${styles.statusDot} ${styles[`dot_${pharmacy.status}`]}`} />
                {STATUS_LABELS[pharmacy.status]}
                {!pharmacy.is_open_now ? <span>Закрыто</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function PharmacySheet({
  pharmacy,
  productName,
  placement,
  onClose,
}: {
  pharmacy: PharmacyByProductItem;
  productName: string;
  placement: "floating" | "inline";
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const whatsappHref = formatWhatsappHref(pharmacy.whatsapp, productName);
  const phoneHref = formatPhoneHref(pharmacy.phone);
  const routeHref = formatRouteHref(pharmacy);

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

  return (
    <aside
      className={`${styles.sheet} ${
        placement === "inline" ? styles.sheetInline : styles.sheetFloating
      }`}
      ref={sheetRef}
      aria-label="Карточка аптеки"
    >
      <div className={styles.sheetHeader}>
        <div>
          <span className={styles.sheetTier}>
            {pharmacy.tier === "Chain"
              ? "Сетевая аптека"
              : pharmacy.tier === "2"
                ? "Крупная частная аптека"
                : "Малая аптека"}
          </span>
          <h2>{pharmacy.name}</h2>
        </div>
        <span className={styles.distanceBadge}>
          {formatDistance(pharmacy.distance_meters)}
        </span>
      </div>

      <div className={styles.sheetFacts}>
        <span>{pharmacy.address}</span>
        <span>{pharmacy.is_24_7 ? "Круглосуточно" : getTodaySchedule(pharmacy.working_hours)}</span>
        <span>{pharmacy.is_open_now ? "Сейчас открыто" : "Сейчас закрыто"}</span>
        <span>{STATUS_LABELS[pharmacy.status]}</span>
      </div>

      <p className={styles.statusHint}>{STATUS_HINTS[pharmacy.status]}</p>

      <div className={styles.sheetActions}>
        {whatsappHref ? (
          <a
            className={styles.whatsappAction}
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
          >
            {pharmacy.status === "unknown" ? "Узнать цену" : "Написать в WhatsApp"}
          </a>
        ) : null}
        {phoneHref ? <a href={phoneHref}>Позвонить</a> : null}
        <a href={routeHref} target="_blank" rel="noreferrer">
          Проложить маршрут
        </a>
      </div>
    </aside>
  );
}
