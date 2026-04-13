import React from "react";

export const Woodpecker: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className="shrink-0"
  >
    {/* Body */}
    <ellipse cx="10.5" cy="14" rx="4.5" ry="5.5" fill="#0f172a" />
    {/* Head */}
    <circle cx="13" cy="7.5" r="4" fill="#0f172a" />
    {/* Crest */}
    <path d="M10.5 4L12 1.5 13 4" fill="#ffd600" />
    {/* Beak */}
    <path d="M17 7L21.5 7.5 17 8Z" fill="#ffd600" />
    {/* Eye ring */}
    <circle cx="14.5" cy="6.5" r="1.4" fill="#ff9100" />
    {/* Pupil */}
    <circle cx="14.8" cy="6.3" r="0.7" fill="#0f172a" />
    {/* Eye highlight */}
    <circle cx="15.1" cy="6" r="0.3" fill="#fff" />
    {/* Wing */}
    <path
      d="M7.5 12.5c2-1.2 5-0.8 6.5 0.8"
      stroke="rgba(255,255,255,0.12)"
      strokeWidth="0.8"
      fill="none"
    />
    {/* Belly */}
    <ellipse cx="10.5" cy="15.5" rx="2.5" ry="3" fill="#1e293b" />
    {/* Tail feathers */}
    <path
      d="M7.5 19L5 22.5M9 19.5L7 22.5"
      stroke="#0f172a"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Feet */}
    <path
      d="M9 19.5L8 20.5M11.5 19.5L12.5 20.5"
      stroke="#ffd600"
      strokeWidth="0.8"
      strokeLinecap="round"
    />
  </svg>
);
