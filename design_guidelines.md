# Memento Agent Trace Visualizer - Design Guidelines

## Design Approach

**Selected Approach:** Modern Developer Tool Aesthetic with Glass-morphism Elements

Drawing inspiration from Linear's precision, Vercel's polish, and ChatGPT's approachable interface to create a professional debugging tool that feels premium yet functional.

## Core Design Principles

1. **Clarity First**: Data visualization demands crystal-clear hierarchy and uncluttered layouts
2. **Purposeful Depth**: Use glass-morphism sparingly for elevation, not decoration
3. **Instant Feedback**: Every interaction provides immediate visual response
4. **Information Density**: Maximize useful data while maintaining breathing room

---

## Typography

**Font Stack:**
- Primary: Inter (via Google Fonts CDN) - exceptional readability at all sizes
- Monospace: JetBrains Mono (for JSON, IDs, technical data)

**Scale:**
- Hero/Page Title: text-3xl font-semibold (30px)
- Section Headers: text-xl font-semibold (20px)
- Body/Node Content: text-base font-normal (16px)
- Metadata/Labels: text-sm font-medium (14px)
- Technical Data: text-xs font-mono (12px)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 20
- Tight spacing: p-2, gap-2 (within components)
- Standard spacing: p-4, gap-4, m-4 (component padding)
- Section spacing: p-8, gap-8, mb-8 (between major sections)
- Generous spacing: p-12, p-16 (canvas padding)

**Grid Structure:**
- Main canvas: Full viewport with fixed header (h-16)
- Two-panel layout: 70% canvas / 30% inspector panel (when node selected)
- Upload zone: Centered container max-w-4xl

---

## Component Library

### Primary Components

**Upload Interface:**
- Drag-and-drop zone with dashed border (border-2 border-dashed)
- Centered vertically on empty state
- Large dropzone area (min-h-96) with upload icon (Heroicons: ArrowUpTray)
- Paste JSON textarea with monospace font
- Single prominent "Visualize" button

**Graph Canvas:**
- Full viewport background with subtle gradient
- Infinite canvas with pan/zoom controls
- Grid pattern overlay (faint, 20px spacing)
- Node rendering via React Flow library

**Node Styles (by type):**
- Thought: Blue accent (bg-blue-50, border-blue-400)
- Action: Orange accent (bg-orange-50, border-orange-400)
- Output: Purple accent (bg-purple-50, border-purple-400)
- Observation: Green accent (bg-green-50, border-green-400)
- Error states: Red border-2, red glow effect
- Low confidence (<0.6): Yellow warning indicator dot

All nodes: Rounded-lg, drop shadow, white background with colored left border (border-l-4)

**Inspector Panel:**
- Right-side slide-in panel (w-96)
- Glass-morphism: backdrop-blur-xl with semi-transparent white background
- Sticky header with node type badge and close button
- Scrollable content area with sections:
  - Node Type & ID (monospace)
  - Content (larger text, readable)
  - Timestamp (formatted, text-sm)
  - Confidence meter (horizontal bar, colored)
  - Raw Metadata (collapsible, JSON formatted with syntax highlighting)

**Header Bar:**
- Fixed top (h-16), glass-morphism effect
- Left: Logo/title "Memento" (text-xl font-semibold)
- Center: Mode toggle (Graph / Timeline views)
- Right: Export button, Settings icon

**Control Toolbar:**
- Floating bottom-left of canvas
- Glass-morphism container with rounded-full
- Zoom controls (+/−), Fit View, Reset Layout icons
- Small, compact buttons with hover states

### Secondary Components

**Timeline Mode:**
- Horizontal chronological view
- Steps as cards aligned left to right
- Connecting lines between sequential steps
- Same color coding as graph nodes
- Scroll horizontally to navigate

**Export Modal:**
- Centered overlay with backdrop blur
- Options: PNG, SVG format selection
- "Download" button with loading state

**Error States:**
- Toast notifications for JSON parsing errors
- Inline error message in upload zone if invalid format
- Helpful hints: "Check JSON structure" with code snippet example

---

## Glass-morphism Implementation

**Where to Apply:**
- Header navigation bar
- Inspector side panel
- Floating control toolbar
- Modal overlays

**Treatment:**
- backdrop-blur-xl or backdrop-blur-lg
- Semi-transparent white: bg-white/80 or bg-white/90
- Subtle border: border border-white/20
- Drop shadow for depth: shadow-lg or shadow-2xl

**Where NOT to Apply:**
- Graph nodes (need solid backgrounds for readability)
- Upload zone (keep simple and functional)
- Timeline cards

---

## Interactive States

**Nodes:**
- Default: Subtle shadow, solid background
- Hover: Scale 1.02, deeper shadow, cursor pointer
- Selected: Blue ring-2, elevated shadow-xl
- Connected path: All related nodes highlight with reduced opacity on others

**Buttons:**
- Primary (Visualize, Export): Solid background, rounded-lg, text-white, hover scale 1.02
- Secondary (Close, Cancel): Ghost style, border, hover bg-gray-100
- Icon buttons: Rounded-full, p-2, hover bg-gray-100/50

**Panel/Modal Entrance:**
- Slide-in from right (Inspector): duration-300 ease-out
- Fade-in (Modals): duration-200 ease-in-out

---

## Icons

**Library:** Heroicons (via CDN)
**Usage:**
- Upload: ArrowUpTrayIcon
- Close: XMarkIcon
- Expand/Collapse: ChevronDownIcon/ChevronUpIcon
- Export: ArrowDownTrayIcon
- Zoom: MagnifyingGlassPlusIcon/MinusIcon
- Settings: Cog6ToothIcon
- Warning (low confidence): ExclamationTriangleIcon
- Error: XCircleIcon

---

## Animations

Use sparingly for functional feedback only:
- Node selection: Quick scale bounce (duration-150)
- Panel open/close: Smooth slide transition (duration-300)
- Hover states: Subtle scale/shadow (duration-200)
- Toast notifications: Slide-in from top

**NO decorative animations, parallax, or auto-playing effects**

---

## Accessibility

- All interactive nodes: Keyboard navigable (tab order)
- ARIA labels on icon-only buttons
- Focus visible rings on all focusable elements (ring-2 ring-blue-500)
- High contrast mode support (maintain 4.5:1 minimum for text)
- Screen reader announcements for node selection and panel changes