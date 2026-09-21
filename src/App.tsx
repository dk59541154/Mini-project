/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    // If rendered as client-side Vite SPA, redirect to home page template
    if (window.location.pathname === "/src/" || window.location.pathname === "/index.html") {
      window.location.replace("/");
    }
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h2>CivicEye AI - Smart Road &amp; Infrastructure Auditor</h2>
      <p>Loading application...</p>
      <a href="/" style={{ color: "#2563eb", textDecoration: "underline" }}>Open CivicEye Portal</a>
    </div>
  );
}
