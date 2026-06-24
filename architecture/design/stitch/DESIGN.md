---
name: AISea
colors:
  surface: '#EDEBE4'
  surface-dim: '#dcd9cf'
  surface-bright: '#fbf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f6f1'
  surface-container: '#f2f0e9'
  surface-container-high: '#ebe9e1'
  surface-container-highest: '#e6e3db'
  on-surface: '#14181C'
  on-surface-variant: '#3a4048'
  inverse-surface: '#14181C'
  inverse-on-surface: '#EDEBE4'
  outline: '#9AA0A6'
  outline-variant: '#E6E3DB'
  surface-tint: '#C8F051'
  primary: '#14181C'
  on-primary: '#ffffff'
  primary-container: '#1f262d'
  on-primary-container: '#d7dadd'
  inverse-primary: '#C8F051'
  accent: '#C8F051'
  on-accent: '#14181C'
  accent-container: '#eef9c9'
  on-accent-container: '#2c3500'
  secondary: '#3a4048'
  on-secondary: '#ffffff'
  secondary-container: '#dfe2e5'
  on-secondary-container: '#1b2026'
  tertiary: '#4d000a'
  on-tertiary: '#ffffff'
  tertiary-container: '#750015'
  on-tertiary-container: '#ff7576'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eef9c9'
  primary-fixed-dim: '#dcf2a3'
  on-primary-fixed: '#2c3500'
  on-primary-fixed-variant: '#404d00'
  secondary-fixed: '#dfe2e5'
  secondary-fixed-dim: '#c3c8cd'
  on-secondary-fixed: '#14181C'
  on-secondary-fixed-variant: '#3a4048'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b1'
  on-tertiary-fixed: '#410007'
  on-tertiary-fixed-variant: '#92001c'
  background: '#EDEBE4'
  on-background: '#14181C'
  surface-variant: '#e6e3db'
  surface-light: '#F7F6F1'
  surface-border: '#E6E3DB'
  text-primary: '#14181C'
  text-secondary: '#3a4048'
  text-disabled: '#9AA0A6'
  accent-red: '#E63946'
  region-na: '#4F8BFF'
  region-sa: '#34D399'
  region-me: '#FBBF24'
  region-eu: '#C8F051'
  region-apac: '#FB7185'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 0.75rem
  md: 1rem
  lg: 1.25rem
  xl: 1.875rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The **AISea** design system is engineered for a modern, data-driven enterprise environment that pairs editorial warmth with technological energy. It targets analysts and executives navigating complex global-expansion intelligence, and balances approachable warmth with analytical precision.

The aesthetic is **Modern Enterprise / Data Storytelling**, characterized by a warm beige canvas, high-contrast ink-black structure, and a single electric lime-green accent reserved for action and emphasis. It mixes a light beige working surface with deliberate dark "hero" zones (ink-black cards, the dashboard map) to create rhythm and focus. Generous rounding (16–30px) and glassmorphism soften the interface, while a tight Space Grotesk display face gives headings a confident, technical voice.

## Colors

The palette is anchored by **Ink Black Primary** (`#14181C`) — used for text, headings, structural emphasis and dark hero surfaces — paired with a warm **Beige background** (`#EDEBE4`) and pure white cards. The signature **Lime-Green Accent** (`#C8F051`) is reserved exclusively for *fill* actions: primary buttons, the selected navigation state, key highlights, and emphasis markers. Because lime-green is bright and fails contrast as a text color, it is never used for body text — text on a lime surface is always Ink Black (`#14181C`).

Region hues encode geography across the map, emblems, and charts: NA `#4F8BFF`, SA `#34D399`, ME `#FBBF24`, EU `#C8F051`, APAC `#FB7185`. Diagnostic signal colors (Success green, Warning amber, Danger/Error red) are preserved as data-meaning colors independent of theme. Text is tiered with Ink Black for headers and softened grays (`#3a4048`, `#9AA0A6`) for metadata.

## Typography

This design system pairs **Space Grotesk** (display — headings and emphasis, tight tracking, technical character) with **Hanken Grotesk** (body — exceptional clarity at small sizes) and **Pretendard** (Korean fallback). The type scale is optimized for high-density data interfaces where legibility at small sizes is paramount.

Headlines use Space Grotesk with tighter letter-spacing and heavier weights to create a strong visual anchor. Body text is set in Hanken Grotesk with generous line heights to facilitate long-form reading of reports. Labels and captions utilize semi-bold weights and slight tracking to remain distinct even at 11px-12px.

## Layout & Spacing

The layout is built on a **12-column fluid grid** for desktop and a **4-column fluid grid** for mobile. A strict 4px base increment governs all spacing, ensuring rhythmic consistency across components.

- **Desktop:** 12 columns, 24px gutters, 48px side margins.
- **Tablet:** 8 columns, 24px gutters, 32px side margins.
- **Mobile:** 4 columns, 16px gutters, 16px side margins.

Horizontal spacing between related elements (like an icon and its label) should use `xs` (4px) or `sm` (8px), while vertical separation between distinct sections should use `xl` (32px) or higher.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** supplemented by **Ambient Shadows** (ink-black tinted) and **Glassmorphism** on dark zones.

1. **Level 0 (Base):** Warm beige (#EDEBE4) canvas for primary content areas.
2. **Level 1 (Surface):** Light beige (#F7F6F1) for secondary sidebars or navigation bars, often separated by a 1px border (#E6E3DB).
3. **Level 2 (Cards):** White surfaces with a soft, 12% opacity ink-tinted shadow `rgba(12,16,22,0.12)` (8px blur, 4px Y-offset).
4. **Level 3 (Popups/Modals):** High-elevation surfaces with an 18% opacity ink-tinted shadow (24px blur, 12px Y-offset) to indicate immediate interaction priority.

Dark hero zones (ink-black cards, dashboard map) use glassmorphism: semi-transparent ink fills `rgba(20,24,28,.62)` with hairline `rgba(255,255,255,.09)` borders. Backdrop blurs (8px - 12px) are used behind modals and the header to maintain context while focusing the user on the task at hand.

## Shapes

The shape language is rounded and approachable, reflecting AISea's editorial-meets-technical character.

- **Standard Components:** Buttons and input fields use a 16px radius.
- **Containment:** Standard cards and content modules use 16–20px; large hero cards up to 30px.
- **Overlays:** Modals, popups, and dialogs use a pronounced 20–30px radius to soften their impact on the interface.
- **Status Markers:** Small badges and tags are fully rounded (pill-shaped) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary (Accent):** Solid Lime-Green (#C8F051) background with Ink-Black text (#14181C). ~20–30px radius. Subtle translate on hover.
- **Solid (Ink):** Solid Ink-Black background with White text. Used for high-contrast primary actions on light surfaces.
- **Outline:** 1px border using Ink Black, transparent background. Text in Ink Black.
- **Text:** No border or background. Ink Black text. Used for secondary navigation or "Cancel" actions.

### Inputs
- Height: 46px for standard, 40px for dense.
- Style: 1px border (#E6E3DB) with 16–24px radius. Focus state uses a 2px Ink-Black border (lime-green is avoided on focus rings for contrast).

### Badges & Status
- Small, uppercase label text.
- Use Semantic colors: Success (Green), Warning (Amber), Error (Red/Accent). Highlight/Info badges use lime-green fill with ink-black text. Backgrounds should be 10-16% opacity of the accent/semantic color.

### Progress Bars
- 6px–9px height.
- Track: Beige (#EDEBE4 / #e6e3db).
- Indicator: Lime-Green (#C8F051) for emphasis, or Ink Black for neutral data, with smooth `cubic-bezier(.2,.7,.3,1)` width transition.

### Modals & Popups
- 20–30px corner radius.
- Centered on screen with a dark, semi-transparent backdrop. `aisea-pop` entrance animation.
- Header includes a clear title in `headline-md` (Space Grotesk) and a close icon in the top right.

### Cards
- White background, 1px border (#E6E3DB), and Level 2 ink-tinted shadow. Dark hero cards use ink-black fills with lime-green accents.
- Inner padding should follow the `lg` (24px) spacing token.