"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost = window.location.hostname === "localhost";
    const isSecureOrigin = window.location.protocol === "https:";

    if (!isLocalhost && !isSecureOrigin) {
      return;
    }

    const registerWorker = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update())
        .catch((error) => {
          console.error("Не удалось зарегистрировать service worker:", error);
        });
    };

    if (document.readyState === "complete") {
      registerWorker();
      return;
    }

    window.addEventListener("load", registerWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerWorker);
    };
  }, []);

  return null;
}
