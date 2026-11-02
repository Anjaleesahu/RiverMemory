import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import WaterQuality from "./pages/WaterQuality";
import Rainfall from "./pages/Rainfall";
import Comparison from "./pages/Comparison";
import Relationship from "./pages/Relationship";
import Incidents from "./pages/Incidents";
import MapPage from "./pages/MapPage";
import Timeline from "./pages/Timeline";
import Sources from "./pages/Sources";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import YearReview from "./pages/YearReview";
import TriveniStory from "./pages/TriveniStory";
import RiverExplorer from "./pages/RiverExplorer";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <ScrollTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<TriveniStory />} />
          <Route path="/story" element={<TriveniStory />} />
          <Route path="/about" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/insights" element={<YearReview />} />
          <Route path="/water-quality" element={<WaterQuality />} />
          <Route path="/rainfall" element={<Rainfall />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/relationship" element={<Relationship />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/river-explorer" element={<RiverExplorer />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<div className="empty">Page not found.</div>} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}