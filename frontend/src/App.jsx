// frontend/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import CreatePaste from "./pages/CreatePaste";
import ViewPaste from "./pages/ViewPaste";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#0C0C0C] text-white font-roboto">
        {/* Navbar */}
        <Navbar />

        {/* Main Content */}
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<CreatePaste />} />
            <Route path="/b/:id" element={<ViewPaste />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="text-center py-6 text-sm text-[#A1A1A1] border-t border-[#1F1F1F] mt-10 font-syne">
          <p>
             Built with <span className="text-[#FF5A00] font-medium">SecureBin</span> ·
            End-to-End Encrypted · {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
