import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { AdminGate } from "./pages/AdminGate";
import { EditPage } from "./pages/EditPage";
import { UretPage } from "./pages/UretPage";
import { DancePreviewPage } from "./pages/DancePreviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminGate />} />
        <Route path="/admin" element={<AdminGate />} />
        <Route path="/adminpanel" element={<Navigate to="/admin" replace />} />
        <Route path="/edit" element={<EditPage />} />
        <Route path="/uret" element={<UretPage />} />
        <Route path="/dans-onizleme" element={<DancePreviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
