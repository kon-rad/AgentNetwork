# Design System Strategy: The Synthetic Frontier

## 1. Overview & Creative North Star
**Creative North Star: "The Neural HUD"**
This design system rejects the "flat web" movement in favor of a high-fidelity, tactical interface. It envisions a world where the marketplace is not a website, but a decrypted terminal—an "Agentic Marketplace" where human intent meets machine precision. By blending the gritty, high-tech cynicism of *Ghost in the Shell* with the chaotic, metallic optimism of the Y2K era (Winamp skins, Frutiger Aero depth), we create a "Digital Maximalist" experience.

The design breaks the template look through **intentional asymmetry**. Layouts should feel like a modular command center, utilizing skewed grids, terminal-style data readouts, and "floating" HUD elements that suggest a 3D space beyond the screen.

---

## 2. Colors & Atmospheric Depth
Our palette is rooted in a "Deep Void" black, layered with hyper-saturated electric accents.

*   **Primary (`#00f0ff`):** The "Life-Link." Used for interactive glows, active data streams, and primary actions.
*   **Secondary (`#f0b932`):** The "Value-Tier." Reserved exclusively for rewards, token balances, and high-value agent status.
*   **The "No-Line" Rule:** We prohibit 1px solid borders for structural sectioning. Boundaries are defined by `surface-container` shifts or "light-leaks."
*   **Surface Hierarchy & Nesting:**
    *   **Level 0 (`surface-dim`):** The background canvas.
    *   **Level 1 (`surface-container-low`):** Main content areas.
    *   **Level 2 (`surface-container-high`):** Interactive modules.
    *   **Level 3 (`surface-bright`):** Modals and HUD overlays.
*   **The Glass & Gradient Rule:** All cards must utilize Glassmorphism (`surface` at 60% opacity with a 12px backdrop-blur). To avoid a "default" look, apply a subtle linear gradient from `primary` (at 10% opacity) to `transparent` across the card face to simulate a screen reflection.

---

## 3. Typography: The Brutalist Monospace
We contrast the exaggerated geometry of **Syne** with the cold, functional precision of **Geist Mono**.

*   **Headlines (Syne):** Used for "Mission Objectives" and high-level branding. Syne’s ultra-wide characters provide the "Anime Title Card" aesthetic.
*   **UI & Data (Geist Mono):** Every piece of functional data—prices, timestamps, agent logs—must be Geist Mono. This reinforces the "terminal" feel.
*   **Hierarchy as Code:** Use `label-sm` in all caps for metadata (e.g., `STATUS: ACTIVE`). Use `display-lg` for hero sections, but track it tightly (-0.02em) to maintain a dense, industrial look.

---

## 4. Elevation & Depth: The HUD Principle
We achieve depth through **Tonal Layering** and "Analog Artifacts" rather than traditional dropshadows.

*   **The Layering Principle:** Stack `surface-container-lowest` elements on top of `surface-container-high` backgrounds. This creates a "recessed" look, making the UI feel like physical hardware.
*   **Ambient Glows:** Instead of black shadows, use `primary` (Electric Cyan) glows for active elements. Shadows must be diffused (20px - 40px blur) at extremely low opacities (8%).
*   **The "Ghost Border":** For containers, use `outline-variant` at 20% opacity. Add "Corner Ticks"—small L-shaped brackets at the four corners of a container—to simulate a targeting reticle.
*   **CRT Overlays:** Apply a global fixed overlay of scan-lines (1px repeating linear gradient) at 3% opacity. This "glues" the disparate Y2K and Sci-fi elements into a single cohesive viewport.

---

## 5. Components: The Tactical Toolkit

### Buttons (The "Pulse" Variants)
*   **Primary:** Solid `primary-container` background with a `primary` outer glow. On hover, the button should "pulse" using a CSS scale transformation (1.02x) and an increased shadow spread.
*   **Secondary:** Ghost-style with `primary` corner brackets. Metallic "Chrome" hover effect using a subtle silver-to-cyan gradient.
*   **Tertiary:** Text-only in `Geist Mono` with a `>` prefix.

### Bounty Cards (The "Mission" Module)
*   **Structure:** No dividers. Use `surface-container-lowest` for the header and `surface-container-low` for the body.
*   **Status Indicators:** Styled as Stencil-type military stamps (e.g., "VERIFIED" in `success` green with a slight distressed texture).
*   **Avatar Frames:** Strictly hexagonal or diamond. Use a 2px `primary` stroke with a "flicker" animation on hover.

### Badges & Insignias
*   **Holographic Stickers:** Service type badges (Filmmaker, Coder, etc.) should use high-contrast backgrounds with a "pearlescent" CSS overlay that shifts on mouse move, mimicking Y2K-era collectible stickers.

### Data Inputs
*   **Terminal Fields:** Input fields are `surface-container-highest` with no rounded corners. The cursor should be a solid `primary` block that blinks.
*   **Error States:** Instead of just red text, trigger a "glitch" animation where the container momentarily shifts 2px horizontally.

---

## 6. Do’s and Don’ts

### Do:
*   **Use 0px Border Radius:** This system is built on hard edges. Circular elements are forbidden unless they are part of a specific HUD dial or "loading" sequence.
*   **Embrace Intentional Asymmetry:** If a sidebar is 300px, make the right-side "System Log" 280px. This breaks the "Wordpress" feel.
*   **Layer Textures:** Combine a subtle noise texture with the CRT scan-lines to give the "Deep Void" background depth.

### Don’t:
*   **Don't Use Standard Grids:** Avoid the 12-column bootstrap look. Use "Nested Pods" where information is clustered into functional zones.
*   **Don't Use Soft UI:** No rounded corners (`0px` scale is absolute). No pastel colors outside of the specific service-type badges.
*   **Don't Use Transparency Alone:** If an element is transparent, it *must* have a backdrop-blur. Transparency without blur looks like a bug; with blur, it looks like high-end hardware.

### Accessibility Note:
While we embrace "Digital Maximalism," ensure that all `Geist Mono` data readouts maintain a contrast ratio of at least 4.5:1 against the `surface-container` tiers. Use the `primary-fixed` token for text on dark backgrounds to ensure legibility.