"use client";

import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header style={{ padding: "24px 24px 0" }}>
            <div
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px"
              }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: 24 }}>Autopilot Shorts</h1>
                <p style={{ marginTop: 6, color: "rgba(255,255,255,0.62)" }}>
                  Autonomous pipeline for scanning, scheduling, and publishing YouTube Shorts.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="pill">Operational</span>
                <div style={{ fontSize: 12, marginTop: 8, color: "rgba(255,255,255,0.45)" }}>
                  Next run triggered via Vercel cron.
                </div>
              </div>
            </div>
          </header>
          <main className="app-main">{children}</main>
          <footer style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
            © {new Date().getFullYear()} Agentic Shorts Autopilot
          </footer>
        </div>
      </body>
    </html>
  );
}
