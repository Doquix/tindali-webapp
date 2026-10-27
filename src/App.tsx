import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Assistant from "./pages/Assistant";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import ProductForm from "./pages/ProductForm";
import Reports from "./pages/Reports";
import Scan from "./pages/Scan";

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export default function App() {
  const online = useOnline();
  return (
    <div className="app">
      {!online && <div className="banner">Offline: your sales are saved on this phone. The AI needs internet.</div>}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/new" element={<ProductForm />} />
        <Route path="/inventory/:id" element={<ProductForm />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/ai" element={<Assistant />} />
      </Routes>
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>
          <span className="nav-icon" aria-hidden>⌂</span>Home
        </NavLink>
        <NavLink to="/inventory">
          <span className="nav-icon" aria-hidden>▤</span>Inventory
        </NavLink>
        <NavLink to="/scan" className="scan-fab" aria-label="Scan">
          <span aria-hidden>⌁</span>
        </NavLink>
        <NavLink to="/reports">
          <span className="nav-icon" aria-hidden>▥</span>Reports
        </NavLink>
        <NavLink to="/ai">
          <span className="nav-icon" aria-hidden>✦</span>Ask AI
        </NavLink>
      </nav>
    </div>
  );
}
