import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

export default function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: boolean;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="header-bar">
      {onBack && (
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Zurück">
          ←
        </button>
      )}
      <h2 style={{ flex: 1 }}>{title}</h2>
      {right}
    </div>
  );
}
