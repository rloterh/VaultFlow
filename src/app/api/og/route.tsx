import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") ?? "VaultFlow";
  const subtitle = searchParams.get("subtitle") ?? "Financial Dashboard & Invoice Platform";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#FAFAFA",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "#171717",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            V
          </div>
          <span style={{ fontSize: "20px", fontWeight: 600, color: "#171717" }}>
            VaultFlow
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 30 ? "48px" : "56px",
            fontWeight: 700,
            color: "#171717",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: "800px",
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "20px",
            color: "#737373",
            marginTop: "16px",
            maxWidth: "600px",
          }}
        >
          {subtitle}
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            backgroundColor: "#171717",
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
