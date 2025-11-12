
import React from "react";
import { expiryOptions } from "../utils/helpers";
import { Clock } from "lucide-react";

export default function TimerSelector({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2 mt-4">
      {/* Label */}
      <label
        htmlFor="expiry"
        className="flex items-center gap-2 text-sm font-medium text-[#A1A1A1]"
      >
        <Clock size={16} className="text-[#FF5A00]" />
        Expiration Time
      </label>

      {/* Dropdown */}
      <div className="relative">
        <select
          id="expiry"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#151515] border border-[#2A2A2A] text-[#FFFFFF]
                     rounded-[8px] py-2.5 px-3 text-sm appearance-none
                     focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/30
                     transition-all duration-200 outline-none"
        >
          {expiryOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#151515] text-[#FFFFFF]">
              {opt.label}
            </option>
          ))}
        </select>

        {/* ▼ Dropdown Indicator */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A1] pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Description */}
      <p className="text-xs text-[#666666] mt-1">
        Select how long the paste will remain accessible before it expires.
      </p>
    </div>
  );
}
