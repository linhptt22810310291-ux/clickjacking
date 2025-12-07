// src/components/layout/user/UserLayout.js
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ChatWidget from "../../ChatWidget";

export default function UserLayout() {
  return (
    <div className="user-layout">
      <Navbar />
      <main className="content">
        <Outlet /> {/* ✅ render các route con như Home, Products,... */}
      </main>
      <Footer />
      <ChatWidget /> {/* 💬 Chat support widget */}
    </div>
  );
}
