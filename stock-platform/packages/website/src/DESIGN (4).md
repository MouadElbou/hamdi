# Design System Document

## 1. Overview & Creative North Star
This design system is engineered to elevate high-performance e-commerce from a utility to an editorial experience. The **Creative North Star** for this system is **"The Precision Curator."** 

Unlike traditional e-commerce sites that rely on cluttered grids and heavy borders, this system uses expansive white space, intentional asymmetry, and a sophisticated layering of tech-forward tones to guide the user. We are moving away from the "catalog" feel toward a "digital showroom" where every product is treated as a high-end artifact. By leveraging the contrast between the authoritative `Lexend` display type and the utilitarian `Work Sans` body, we create a rhythmic visual flow that feels both premium and profoundly trustworthy.

## 2. Colors
Our palette is rooted in a deep, "Electric Royal" foundation, balanced by an expansive range of architectural neutrals.

*   **Primary Roles:** The `primary` (#0014bd) and `primary_container` (#2a39d4) are our brand anchors. They represent action and authority.
*   **Secondary/Tertiary Roles:** `secondary` (#00687b) provides a cooling, technical contrast, while `tertiary` (#1500c5) is reserved for high-impact accents and interactive states.
*   **The "No-Line" Rule:** To ensure a premium feel, 1px solid borders are prohibited for sectioning. Use background shifts (e.g., placing a `surface_container_low` section against a `surface` background) to define boundaries.
*   **Surface Hierarchy & Nesting:** Depth is created through stacking. A product card should be `surface_container_lowest` (pure white) sitting on a `surface_container` (soft lavender-grey) background. This creates "natural" containment without rigid lines.
*   **The "Glass & Gradient" Rule:** Use `backdrop-blur` on navigation bars and floating modals using semi-transparent `surface` tokens. Main CTAs should utilize a subtle linear gradient from `primary` to `primary_container` (top-to-bottom) to add a tactile, high-end "soul" to the interface.

## 3. Typography
The typography system is a hierarchy of intent, mixing the geometric confidence of Lexend with the readability of Work Sans and Inter.

*   **Display & Headline (Lexend):** Used for product titles and hero sections. The geometric nature of Lexend communicates modern precision and tech-literacy. Use `display-lg` for flagship hero offers to create a "magazine-spread" impact.
*   **Title & Body (Work Sans):** Work Sans is our workhorse. Its slightly wider apertures ensure that technical specifications and long-form descriptions remain legible and professional.
*   **Label (Inter):** Reserved for technical metadata, price labels, and micro-copy. Its neutral, compact nature prevents the UI from feeling "crowded" even when information density is high.

## 4. Elevation & Depth
In "The Precision Curator" system, elevation is a physical property defined by light and tone, not just drop shadows.

*   **The Layering Principle:** Avoid traditional shadows where possible. Instead, "nest" containers. For instance, a detailed product spec table should sit on `surface_container_high` to distinguish it from the main description body on `surface`.
*   **Ambient Shadows:** If an element must "float" (like a sticky "Add to Cart" mobile bar), use a shadow tinted with `on_surface` at 6% opacity with a 32px blur. It should feel like a soft glow of ambient light, not a hard shadow.
*   **The "Ghost Border" Fallback:** If a product image requires a frame, use the `outline_variant` token at **15% opacity**. This creates a "Ghost Border"—a suggestion of a boundary that doesn't interrupt the visual flow.
*   **Glassmorphism:** Use for "Quick View" overlays. Use `surface_variant` at 80% opacity with a `20px` blur to allow product colors to bleed through, keeping the experience integrated.

## 5. Components

### Buttons
*   **Primary:** High-gloss gradient (`primary` to `primary_container`). `xl` roundedness (0.75rem). Use `headline-sm` for text to maintain authority.
*   **Secondary:** Ghost style. `outline_variant` (at 20% opacity) with `primary` text.
*   **Tertiary:** No background. `primary` text with a subtle `2px` underline on hover.

### Product Cards
*   **Layout:** No external borders. Use `surface_container_lowest` for the card body. 
*   **Spacing:** Use a 24px internal padding. 
*   **Interaction:** On hover, the card should transition from `surface_container_lowest` to a subtle `surface_bright` with an ambient shadow.

### Input Fields
*   **Styling:** Soft `surface_container_low` background. 
*   **Focus State:** Transition to `primary` ghost border (20% opacity) and a slight internal glow. 
*   **Labels:** Always use `label-md` in `on_surface_variant` to keep the UI clean.

### Navigation & Lists
*   **Navigation:** Top-tier navigation uses `surface` with 90% opacity and a `10px` backdrop blur. No bottom border; use a soft tonal shift to the page content.
*   **Lists:** Forbid divider lines. Separate product specs using 16px of vertical white space and alternating `surface` and `surface_container_low` backgrounds for row-based data.

## 6. Do's and Don'ts

### Do
*   **Do** use intentional asymmetry in hero sections (e.g., product image overlapping a background container).
*   **Do** use `lexend` for all price points to make them feel bold and definitive.
*   **Do** leverage the "Ghost Border" for image thumbnails to give them structure without weight.

### Don't
*   **Don't** use 100% black (#000000) for text; always use `on_surface` (#06006c) to maintain the sophisticated blue-tinted tonal range.
*   **Don't** use `none` or `sm` roundedness for interactive elements. We want the system to feel "approachable tech," so stick to `md` and `xl`.
*   **Don't** use standard grid gaps. Use "Breathing Room"—wide gutters (at least 32px) to allow product photography to dominate the visual field.