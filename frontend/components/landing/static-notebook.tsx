"use client";

/**
 * The composition shown when the 3D scene cannot or should not run — no WebGL,
 * a software rasteriser, or a reader who has asked for reduced motion.
 *
 * Built as a designed alternative rather than an empty state. The same idea has
 * to land: a page of real work, lit from one side, sitting on a surface. It is
 * flat and it does not move, and that is the whole of what is lost.
 *
 * Rendered with CSS and one inline SVG, so it costs nothing and appears
 * instantly — it is also what fills the frame while the capability check runs.
 */
export function StaticNotebook({ ready }: { ready: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#0b0d11]">
      {/* Desk falloff */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 30% 20%, rgba(255,238,214,0.13) 0%, transparent 60%), linear-gradient(180deg, #12151b 0%, #0b0d11 70%)",
        }}
      />

      <div
        className="relative w-[min(78vw,30rem)] transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      >
        {/* Contact shadow */}
        <div
          aria-hidden
          className="absolute -inset-x-10 -bottom-8 h-16 rounded-[50%] blur-2xl"
          style={{ background: "rgba(0,0,0,0.55)" }}
        />

        {/* The page */}
        <div
          className="relative aspect-[1/1.414] w-full overflow-hidden rounded-r-md rounded-l-sm"
          style={{
            background: "linear-gradient(105deg, #efe9db 0%, #f6f1e6 22%, #fbf8f1 60%, #f2ecdf 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.5) inset, 0 30px 60px -20px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.4)",
          }}
        >
          {/* Spine shading */}
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-10"
            style={{ background: "linear-gradient(90deg, rgba(70,58,40,0.28), transparent)" }}
          />

          <svg
            viewBox="0 0 500 707"
            className="absolute inset-0 h-full w-full"
            aria-label="A handwritten physics assignment on ruled paper"
          >
            {/* Ruling */}
            <g stroke="rgba(120,145,180,0.30)" strokeWidth="1">
              {Array.from({ length: 22 }, (_, i) => (
                <line key={i} x1="42" y1={110 + i * 25} x2="470" y2={110 + i * 25} />
              ))}
            </g>
            <line x1="42" y1="36" x2="42" y2="672" stroke="rgba(190,120,120,0.4)" strokeWidth="1.4" />

            <g fill="#1c2a4a" fontFamily="var(--font-hand), cursive">
              <text x="52" y="74" fontSize="17">Nadia Islam</text>
              <text x="52" y="96" fontSize="13" fill="#33406b">Grade 10 — Physics</text>
              <text x="52" y="150" fontSize="25" fontWeight="700">Projectile Motion</text>
              <text x="52" y="205" fontSize="14">Q1. A ball is thrown at 20 m/s at 35°.</text>
              <text x="70" y="258" fontSize="15">uₓ = 20 cos 35° = 16.4 m/s</text>
              <text x="70" y="308" fontSize="15">uᵧ = 20 sin 35° = 11.5 m/s</text>
              <text x="70" y="408" fontSize="15">T = 2uᵧ / g = 2.35 s</text>
              <text x="70" y="482" fontSize="15">R = uₓT = 16.4 × 2.35</text>
              <text x="70" y="536" fontSize="19" fontWeight="700">R ≈ 38.5 m</text>
              <text x="300" y="470" fontSize="12" fill="#a8342a">check g = 9.8</text>
            </g>

            <line x1="52" y1="150" x2="240" y2="152" stroke="#1c2a4a" strokeWidth="2" />
            <rect x="62" y="514" width="165" height="26" fill="rgba(250,214,96,0.5)" />
            <line x1="66" y1="546" x2="180" y2="548" stroke="#1c2a4a" strokeWidth="2" />

            {/* Diagram */}
            <g stroke="#33406b" strokeWidth="1.4" fill="none">
              <line x1="310" y1="380" x2="310" y2="270" />
              <line x1="310" y1="380" x2="455" y2="380" />
              <path d="M310 380 Q 382 258 455 380" stroke="#1c2a4a" strokeWidth="1.6" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
