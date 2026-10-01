import { Navigate } from "react-router-dom";

/**
 * Consolidated into Media Hub (`/admin/gallery?tab=portfolio`).
 */
export function AdminPortfolioPage() {
  return <Navigate to="/admin/gallery?tab=portfolio" replace />;
}
