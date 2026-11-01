<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string;
  }>(),
  {
    size: 28,
  }
);
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1024 1024"
    :width="size"
    :height="size"
    fill="none"
    class="app-icon-svg"
    aria-label="PDF Presenter Icon"
  >
    <defs>
      <linearGradient id="appIconBgGrad" x1="112" y1="80" x2="912" y2="944" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="50%" stop-color="#131f38" />
        <stop offset="100%" stop-color="#1e1b4b" />
      </linearGradient>

      <radialGradient id="appIconAmbientGlow" cx="520" cy="480" r="450" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.30" />
        <stop offset="50%" stop-color="#7c3aed" stop-opacity="0.14" />
        <stop offset="85%" stop-color="#1e1b4b" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
      </radialGradient>

      <linearGradient id="appIconRimGrad" x1="120" y1="80" x2="900" y2="940" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.6" />
        <stop offset="50%" stop-color="#818cf8" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#c084fc" stop-opacity="0.5" />
      </linearGradient>

      <linearGradient id="appIconPdfDocGrad" x1="190" y1="168" x2="520" y2="738" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#dbeafe" />
      </linearGradient>

      <linearGradient id="appIconPdfRedGrad" x1="206" y1="220" x2="370" y2="288" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ff4d6d" />
        <stop offset="100%" stop-color="#e11d48" />
      </linearGradient>

      <linearGradient id="appIconSlideGrad" x1="276" y1="296" x2="876" y2="760" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="48%" stop-color="#4f46e5" />
        <stop offset="100%" stop-color="#7c3aed" />
      </linearGradient>

      <linearGradient id="appIconSlideBorderGrad" x1="276" y1="296" x2="876" y2="760" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6" />
        <stop offset="50%" stop-color="#93c5fd" stop-opacity="0.28" />
        <stop offset="100%" stop-color="#ddd6fe" stop-opacity="0.42" />
      </linearGradient>

      <linearGradient id="appIconPlayGrad" x1="510" y1="440" x2="650" y2="590" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#e0e7ff" />
      </linearGradient>

      <radialGradient id="appIconLaserGlow" cx="786" cy="368" r="118" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ff1e42" stop-opacity="0.95" />
        <stop offset="26%" stop-color="#ff2e4c" stop-opacity="0.65" />
        <stop offset="52%" stop-color="#f43f5e" stop-opacity="0.28" />
        <stop offset="78%" stop-color="#f43f5e" stop-opacity="0.08" />
        <stop offset="100%" stop-color="#f43f5e" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- 1. App Icon Squircle Base -->
    <rect x="64" y="64" width="896" height="896" rx="212" fill="url(#appIconBgGrad)" />
    <rect x="64" y="64" width="896" height="896" rx="212" fill="url(#appIconAmbientGlow)" />
    <rect x="68" y="68" width="888" height="888" rx="208" stroke="url(#appIconRimGrad)" stroke-width="8" />

    <!-- 2. Back Layer: Tilted PDF Document Page -->
    <g transform="rotate(-7 380 460)">
      <rect x="154" y="184" width="444" height="572" rx="46" fill="#020617" fill-opacity="0.55" />
      <path
        d="M210 168 H492 L598 274 V694 C598 718.301 578.301 738 554 738 H210 C185.699 738 166 718.301 166 694 V212 C166 187.699 185.699 168 210 168 Z"
        fill="url(#appIconPdfDocGrad)"
      />
      <path
        d="M492 176 L598 274 H520 C500 274 492 262 492 244 V176 Z"
        fill="#64748b"
        fill-opacity="0.25"
      />
      <path
        d="M492 168 L598 274 H524 C506.327 274 492 259.673 492 242 V168 Z"
        fill="#94a3b8"
      />
      <rect x="206" y="218" width="164" height="68" rx="18" fill="url(#appIconPdfRedGrad)" />
      <path
        d="M238 269 V235 H254 C261.5 235 266 239.2 266 246 C266 252.8 261.5 257 254 257 H246 V269 H238 Z M246 250 H253 C256.2 250 258 248.4 258 246 C258 243.6 256.2 242 253 242 H246 V250 Z
           M274 269 V235 H288 C298.5 235 305 241.5 305 252 C305 262.5 298.5 269 288 269 H274 Z M282 262 H287.5 C293.5 262 296.8 258.2 296.8 252 C296.8 245.8 293.5 242 287.5 242 H282 V262 Z
           M314 269 V235 H338 V242 H322 V249 H335 V256 H322 V269 H314 Z"
        fill="#ffffff"
      />
      <rect x="206" y="320" width="236" height="20" rx="10" fill="#64748b" fill-opacity="0.42" />
      <rect x="206" y="358" width="184" height="20" rx="10" fill="#64748b" fill-opacity="0.32" />
      <rect x="206" y="396" width="144" height="20" rx="10" fill="#64748b" fill-opacity="0.24" />
    </g>

    <!-- 3. Layered Elevation Shadow Behind Main Presentation Slide -->
    <rect x="256" y="316" width="616" height="476" rx="60" fill="#020617" fill-opacity="0.32" />
    <rect x="264" y="308" width="606" height="468" rx="56" fill="#020617" fill-opacity="0.48" />

    <!-- 4. Foreground Layer: Widescreen Presentation Slide -->
    <rect x="276" y="296" width="600" height="464" rx="54" fill="url(#appIconSlideGrad)" />
    <rect x="279" y="299" width="594" height="458" rx="51" stroke="url(#appIconSlideBorderGrad)" stroke-width="6" />

    <path
      d="M330 302 H822 C849 302 870 323 870 350 V422 C700 468 450 468 282 422 V350 C282 323 303 302 330 302 Z"
      fill="#ffffff"
      fill-opacity="0.08"
    />

    <!-- Presentation Slide Play Emblem (Center) -->
    <circle cx="576" cy="512" r="110" fill="#0f172a" fill-opacity="0.26" />
    <circle cx="576" cy="512" r="106" stroke="#ffffff" stroke-opacity="0.24" stroke-width="4" />

    <path
      d="M546 442 C536 436 524 443 524 455 V569 C524 581 536 588 546 582 L644 525 C654 519 654 505 644 499 L546 442 Z"
      fill="url(#appIconPlayGrad)"
    />

    <!-- Presenter Progress Bar & Scrubber at Bottom of Slide -->
    <rect x="348" y="686" width="456" height="16" rx="8" fill="#0f172a" fill-opacity="0.34" />
    <rect x="348" y="686" width="284" height="16" rx="8" fill="#38bdf8" />
    <circle cx="632" cy="694" r="15" fill="#ffffff" />

    <!-- 5. Signature Glowing Red Laser Pointer Dot (Top-Right of Slide) -->
    <circle cx="786" cy="368" r="118" fill="url(#appIconLaserGlow)" />
    <circle cx="786" cy="368" r="28" fill="#ff1e42" stroke="#ffffff" stroke-width="5.5" />
    <circle cx="786" cy="368" r="11" fill="#ffffff" />

    <!-- 6. Presenter Stand / Base Indicator -->
    <path
      d="M488 796 H664"
      stroke="#60a5fa"
      stroke-opacity="0.55"
      stroke-width="14"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
.app-icon-svg {
  display: block;
  flex-shrink: 0;
}
</style>
