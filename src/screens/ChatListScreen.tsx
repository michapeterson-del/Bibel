import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ChatGespraech } from "../types";
import { createChat, deleteChat, listChats } from "../lib/db/userDb";

export default function ChatListScreen() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatGespraech[]>([]);

  function refresh() {
    listChats().then(setChats);
  }

  useEffect(refresh, []);

  async function neuerChat(modus: "bibel" | "alltag") {
    const chat = await createChat(modus, modus === "bibel" ? "Einen Vers verstehen" : "Etwas beschäftigt mich");
    navigate(`/chat/${chat.id}`);
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: "1.3rem" }}>Chat</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => neuerChat("bibel")}>+ Vers verstehen</button>
        <button className="btn secondary" style={{ flex: 1 }} onClick={() => neuerChat("alltag")}>+ Alltagsfrage</button>
      </div>

      {chats.length === 0 && <p style={{ color: "var(--text-muted)" }}>Noch keine Gespräche.</p>}

      {chats.map((c) => (
        <div key={c.id} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, cursor: "pointer" }} onClick={() => navigate(`/chat/${c.id}`)}>
            <p style={{ margin: 0, fontWeight: 600 }}>{c.titel}</p>
            <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {c.nachrichten.at(-1)?.text.slice(0, 90) ?? "Noch keine Nachrichten"}
            </p>
          </div>
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Gespräch löschen?")) deleteChat(c.id).then(refresh);
            }}
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
