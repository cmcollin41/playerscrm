import { ImageResponse } from "next/og"
import { readFileSync } from "fs"
import { join } from "path"

export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt =
  "Athletes App — the operating system for your sports program"

const BULLDOG_LOGO_URL =
  "https://zkoxnmdrhgbjovfvparc.supabase.co/storage/v1/object/public/logos/provo-bulldog.svg"

// Load Cal Sans from the project so the OG image headline matches the
// font-display used on the marketing site hero.
const calSansSemiBold = readFileSync(
  join(process.cwd(), "styles", "CalSans-SemiBold.otf"),
)

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          padding: "60px 64px",
          background:
            "linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 55%, #EFF6FF 100%)",
          fontFamily: "Cal, system-ui, sans-serif",
          color: "#0F172A",
        }}
      >
        {/* Left: copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 620,
            paddingRight: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 580,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: 2,
                color: "#EA580C",
                textTransform: "uppercase",
              }}
            >
              Built for sports programs
            </span>
            <h1
              style={{
                margin: 0,
                marginTop: 24,
                fontSize: 80,
                lineHeight: 1.02,
                letterSpacing: -2,
                color: "#0F172A",
              }}
            >
              Run your{" "}
              <span style={{ color: "#EA580C" }}>program.</span>
            </h1>
            <p
              style={{
                margin: 0,
                marginTop: 24,
                maxWidth: 540,
                fontSize: 24,
                lineHeight: 1.35,
                fontFamily: "system-ui, sans-serif",
                color: "#475569",
              }}
            >
              Rosters, events, payments, public profiles, and parent
              communications — in one platform.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: 999,
                background: "#0F172A",
                color: "white",
                fontFamily: "system-ui, sans-serif",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              Start your program →
            </div>
            <span
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 20,
                color: "#64748B",
                fontWeight: 500,
              }}
            >
              athletes.app
            </span>
          </div>
        </div>

        {/* Right: team card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 340,
            marginLeft: "auto",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              padding: 24,
              borderRadius: 20,
              border: "1px solid #E5E7EB",
              background: "white",
              boxShadow: "0 25px 60px -20px rgba(15, 23, 42, 0.25)",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingBottom: 16,
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 56,
                  height: 56,
                  marginRight: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  background: "#F9FAFB",
                  padding: 6,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BULLDOG_LOGO_URL}
                  width={44}
                  height={44}
                  alt=""
                  style={{ width: 44, height: 44, objectFit: "contain" }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    color: "#0F172A",
                    fontFamily: "Cal, system-ui, sans-serif",
                  }}
                >
                  Provo Basketball
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    color: "#64748B",
                    marginTop: 2,
                  }}
                >
                  provobasketball.athletes.app
                </span>
              </div>
              <span
                style={{
                  display: "flex",
                  fontSize: 11,
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "#047857",
                  background: "#ECFDF5",
                  padding: "4px 10px",
                  borderRadius: 999,
                  textTransform: "uppercase",
                }}
              >
                Live
              </span>
            </div>

            {/* Stat tiles */}
            <div
              style={{
                display: "flex",
                marginTop: 18,
                gap: 10,
              }}
            >
              <StatTile label="Teams" value="6" />
              <StatTile label="Players" value="87" />
              <StatTile label="Seasons" value="3" />
            </div>

            {/* Row chips */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 18,
                gap: 8,
              }}
            >
              <RowChip
                label="Varsity Boys · 2026–27"
                value="14 on roster"
                valueBg="#EFF6FF"
                valueColor="#1D4ED8"
              />
              <RowChip
                label="Summer Camp 2026"
                value="Registration open"
                valueBg="#ECFDF5"
                valueColor="#047857"
              />
            </div>
          </div>

          {/* Floating activity badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-end",
              marginTop: -12,
              marginRight: -16,
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #E5E7EB",
              background: "white",
              boxShadow: "0 20px 40px -16px rgba(15, 23, 42, 0.3)",
              transform: "rotate(3deg)",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 30,
                height: 30,
                marginRight: 10,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "#F97316",
                color: "white",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              +
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  color: "#0F172A",
                  fontFamily: "Cal, system-ui, sans-serif",
                }}
              >
                +12
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "system-ui, sans-serif",
                  color: "#64748B",
                }}
              >
                registrations today
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Cal",
          data: calSansSemiBold,
          weight: 600,
          style: "normal",
        },
      ],
    },
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 4px",
        borderRadius: 10,
        background: "#F9FAFB",
      }}
    >
      <span
        style={{
          fontSize: 24,
          color: "#0F172A",
          fontFamily: "Cal, system-ui, sans-serif",
        }}
      >
        {value}
      </span>
      <span
        style={{
          marginTop: 2,
          fontSize: 9,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 700,
          letterSpacing: 1,
          color: "#6B7280",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  )
}

function RowChip({
  label,
  value,
  valueBg,
  valueColor,
}: {
  label: string
  value: string
  valueBg: string
  valueColor: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #F3F4F6",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
        {label}
      </span>
      <span
        style={{
          display: "flex",
          fontSize: 10,
          fontWeight: 700,
          padding: "3px 8px",
          borderRadius: 6,
          background: valueBg,
          color: valueColor,
        }}
      >
        {value}
      </span>
    </div>
  )
}
