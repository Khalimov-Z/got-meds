import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productName = sanitizeText(searchParams.get("name")) || "Препарат";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "#17333d",
          background: "linear-gradient(135deg, #f4fbf8 0%, #e6f2ef 54%, #f6f1e8 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            fontSize: 34,
            fontWeight: 800,
            color: "#316276",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              color: "#ffffff",
              background: "#316276",
              fontSize: 42,
              fontWeight: 900,
            }}
          >
            +
          </div>
          <div>GotMeds</div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "12px 20px",
              borderRadius: 999,
              color: "#316276",
              background: "rgba(255,255,255,0.72)",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            Наличие в Гудермесе
          </div>
          <div
            style={{
              maxWidth: 980,
              fontSize: 76,
              lineHeight: 0.98,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            {productName}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#46616a",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          <span>Цены</span>
          <span style={{ color: "#7fb069" }}>•</span>
          <span>Аптеки рядом</span>
          <span style={{ color: "#7fb069" }}>•</span>
          <span>Карта города</span>
        </div>
      </div>
    ),
    size
  );
}

function sanitizeText(value: string | null) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 90);
}
