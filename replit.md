# Memento - Agent Trace Visualizer

## Overview

Memento is a developer tool for visualizing AI agent execution traces. It transforms raw agent logs from various frameworks (LangChain, LangGraph, OpenAI, custom agents) into interactive visual reasoning maps. The tool helps developers debug agent behavior, understand decision-making processes, and maintain compliance by providing both graph and timeline views of agent execution flows.

The application accepts flexible JSON trace formats, normalizes them into a unified internal model, and renders them as interactive node graphs or chronological timelines with rich metadata inspection capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Improvements (November 2025)

### Debugging Assistant Upgrade (Latest)
- **Trace Analysis Module** (shared/analysis/trace-analyzer.ts):
  - Automated failure detection for 6 issue types: loops, missing observations, empty results, suspicious transitions, contradictions, and ignored errors
  - Risk assessment (Low/Medium/High) based on issue severity and count
  - Issues attached to individual nodes with debugging suggestions
- **Enhanced LangGraph Support** (shared/adapters/generic.ts):
  - Extracts: nodeName, stateBefore, stateAfter, config, runId, threadId, checkpoint, edges
  - Full LangGraph metadata normalization and display
- **Issue Summary Widget** (client/src/components/IssueSummary.tsx):
  - Floating panel showing risk level with color coding
  - Collapsible issue frequency counts by type
- **Enhanced NodeInspector** (client/src/components/NodeInspector.tsx):
  - Issues section with title, description, and suggested fix
  - LangGraph Details section with state/config/edges
  - Risk level display for output nodes
- **Visual Issue Indicators**:
  - Graph nodes show issue count badges and risk indicators
  - Timeline view displays issue and risk badges
- **Sample Traces**: Added "With Issues (Debug)" sample for testing failure detection

### Robust JSON Ingestion Layer
- **Canonical Step Format**: Unified internal model with id, parent_id, type, content, timestamp, raw fields
- **Smart Array Detection**: Searches root, known keys (steps, trace, events, messages, nodes, intermediate_steps, tool_calls), nested paths, and fallback to any array
- **Field Mapping Heuristics**:
  - Type detection via explicit type field, role (tool/function/system), originalKey, tool/action presence, keywords
  - Content extraction from prioritized field list with tool name prefixing
  - Parent linking via explicit fields, tool_call_id mapping, or sequential fallback
- **Framework Compatibility**:
  - LangChain intermediate_steps: Properly expands [action, observation] tuples with unique IDs
  - LangGraph events: Message-based parsing with role detection
  - OpenAI tool_calls: Maps tool_call_id to originating assistant message
  - Custom formats: Flexible field detection and fallback strategies
- **Custom Mapping UI**: Power users can specify stepsPath, idField, typeField, contentField, timestampField (saved to localStorage)
- **Graceful Errors**: Clear messages listing searched keys, available keys, and tips for custom mapping
- **Sample Traces**: Built-in LangGraph, LangChain, OpenAI, Custom, and Simple Array samples for testing

### UI/UX Polish
- **UploadZone**: Enhanced with animated gradient title, sparkles icon, improved drag-over states (border/shadow changes only - no layout shifts), sample traces dropdown, custom mapping integration
- **CustomTraceNode**: Improved shadows (sm to md/lg), subtle hover effects, enhanced error detection matching NodeInspector logic
- **TimelineView**: Added Clock icon, improved spacing (gap-6), better badge styling, background for content sections, max-width container
- **TraceGraph**: Added BackgroundVariant.Dots, polished Controls positioning, improved MiniMap styling, better edge colors

### Error Handling & Recovery
- **ErrorBoundary**: New component for graceful error handling with dual recovery options:
  - "Try Again" (primary) - Preserves in-memory state, just clears error
  - "Return to Home" (secondary) - Full refresh for persistent errors
  - Expandable error details for debugging
- **ParseErrorDisplay**: Friendly parse failure UI with recovery options and format hints

### Export Experience
- **ExportDialog**: Added loading states, better descriptions, auto-close on empty export, improved error handling

### Layout Stability
- Strict adherence to no-layout-shift-on-hover policy
- All hover interactions use shadow/border/color changes only (no scale transforms)
- Interactive controls maintain consistent sizing

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, built using Vite for fast development and optimized production builds.

**UI Component Library**: Radix UI primitives with shadcn/ui styling system, providing accessible, customizable components following the "New York" design variant.

**Styling**: Tailwind CSS with custom design tokens for color theming, glass-morphism effects, and a developer-tool aesthetic inspired by Linear, Vercel, and ChatGPT interfaces. Supports light/dark themes with CSS variable-based color system.

**State Management**: React hooks for local state, TanStack Query (React Query) for server state management with disabled refetching to prevent unnecessary network requests.

**Routing**: Wouter for lightweight client-side routing (currently single-page application with minimal routes).

**Visualization Libraries**:
- **@xyflow/react** (React Flow): Interactive node-based graph visualization for displaying trace execution as connected nodes
- **html-to-image**: Export functionality for saving visualizations as PNG/SVG images

**Data Flow**: 
1. User uploads/pastes JSON trace data via `UploadZone` component
2. `GenericAdapter` normalizes arbitrary trace formats into unified `TraceRun` model
3. Normalized data flows to either `TraceGraph` (node graph view) or `TimelineView` (chronological view)
4. Node selection triggers `NodeInspector` panel with detailed metadata display
5. State managed through React hooks in `Home` page component

**Key Design Patterns**:
- Component composition with shadcn/ui patterns
- Adapter pattern for trace normalization (extensible for new agent frameworks)
- Controlled components for form inputs and interactive elements
- Ref-based DOM manipulation for export functionality

### Backend Architecture

**Server Framework**: Express.js with TypeScript, supporting both development (with Vite middleware) and production modes.

**Development vs Production**:
- **Dev mode** (`index-dev.ts`): Vite development server with HMR, middleware mode for serving React app
- **Production mode** (`index-prod.ts`): Serves pre-built static assets from `dist/public` directory

**API Structure**: Currently minimal - routes defined in `server/routes.ts` with `/api` prefix convention. Storage interface defined but not actively used (skeleton for future backend features).

**Storage Layer**: In-memory storage implementation (`MemStorage`) with interface for potential database integration. Currently provides user CRUD operations as placeholder.

**Request Handling**:
- JSON body parsing with raw body buffering for webhook-style integrations
- Request/response logging middleware with duration tracking
- Error handling for JSON parsing and route execution

**Build Process**:
- Client: Vite builds React app to `dist/public`
- Server: esbuild bundles Express server to `dist/index.js` as ESM module

### Data Storage Solutions

**Database Configuration**: Drizzle ORM configured for PostgreSQL with Neon serverless driver. Schema defined in `shared/schema.ts`, migrations output to `./migrations` directory.

**Current Schema**: Minimal user table with UUID primary keys - appears to be boilerplate rather than active feature.

**Database Approach**: No active database usage in current implementation. The application is stateless - all trace data processed client-side without persistence. Database infrastructure prepared for future features (saving traces, user accounts, etc.).

**Data Models** (`shared/models.ts`):
- `TraceNode`: Individual execution step with type, content, timestamp, confidence, parent relationships, issues, riskLevel, langGraphDetails, and flexible metadata
- `TraceRun`: Container for a complete trace with source identifier, node collection, issues, riskLevel, riskExplanation, and issueSummary
- `NodeType`: Type union for categorizing steps (thought, action, observation, output, system, other)
- `IssueType`: Issue categories (loop, missing_observation, error_ignored, empty_result, contradiction_candidate, suspicious_transition)
- `RiskLevel`: Risk assessment levels (low, medium, high)
- `TraceIssue`: Issue object with type, nodeId, title, description, suggestedFix, and severity
- `LangGraphDetails`: LangGraph-specific metadata (nodeName, stateBefore, stateAfter, config, runId, threadId, checkpoint, edges)

### Authentication and Authorization

**Current State**: No authentication or authorization implemented. User schema exists in database definition but is not connected to any auth flow.

**Prepared Infrastructure**: Session storage configured (`connect-pg-simple`) for Express sessions, suggesting planned session-based authentication.

**Future Implementation**: Architecture supports adding auth middleware, protected routes, and user-specific trace storage.

### Trace Normalization System

**Adapter Pattern**: `TraceAdapter` interface defines contract for parsing different agent framework outputs. Extensible design allows adding framework-specific adapters alongside the generic parser.

**Generic Adapter** (`shared/adapters/generic.ts`): Handles arbitrary JSON structures by:
- Detecting array fields in various locations (steps, trace, nodes, messages, intermediate_steps, tool_calls)
- Inferring node types from content and field names
- Extracting timestamps, confidence scores, and parent relationships
- Generating unique IDs and maintaining execution order
- Preserving original metadata for debugging

**Supported Input Formats**:
- Flat arrays of trace steps
- Nested objects with trace arrays at various paths
- LangChain-style intermediate_steps structures
- Message-based formats
- Tool call sequences

**Normalization Rules**:
- Type detection via keywords (thought, action, observation, output, system)
- Parent-child relationship inference from indices and explicit parentId fields
- Confidence extraction from metadata or defaulting based on type
- Timestamp preservation or generation
- Content extraction from various field names (content, text, message, output)

## External Dependencies

### Third-Party UI Libraries

**Radix UI Primitives**: Comprehensive set of accessible, unstyled UI components (@radix-ui/* packages) - accordion, dialog, dropdown-menu, popover, tabs, tooltip, scroll-area, select, and 20+ other primitives.

**shadcn/ui**: Design system built on Radix UI with Tailwind CSS styling, following "new-york" variant with custom color tokens and component variants.

**Lucide React**: Icon library providing consistent SVG icons (Network, List, Upload, Download, Alert, etc.).

**cmdk**: Command palette/search component for potential future keyboard shortcuts and command interface.

**React Flow (@xyflow/react)**: Graph visualization library for interactive node-based diagrams with pan, zoom, minimap, and connection rendering.

### Development Tools

**Vite**: Build tool and dev server with React plugin, path aliases, and Replit-specific plugins (runtime error overlay, cartographer, dev banner).

**TypeScript**: Strict type checking with ESNext module resolution, path aliases (@/, @shared/, @assets/), and incremental compilation.

**Tailwind CSS**: Utility-first CSS framework with PostCSS processing and custom theme configuration.

**Drizzle Kit**: Database schema management and migration tool for PostgreSQL.

**esbuild**: Fast bundler for server-side code in production builds.

### Runtime Dependencies

**@neondatabase/serverless**: PostgreSQL client for Neon serverless database (edge-compatible).

**@tanstack/react-query**: Data fetching and caching library with disabled automatic refetching.

**Drizzle ORM**: TypeScript ORM for type-safe database queries with Zod schema validation.

**date-fns**: Date/time utility library for formatting and manipulation.

**wouter**: Lightweight routing library (minimalist alternative to React Router).

**class-variance-authority & clsx**: Utility libraries for conditional className composition.

**html-to-image**: DOM-to-image conversion for export functionality.

### Database Services

**Neon Serverless PostgreSQL**: Cloud PostgreSQL database configured via `DATABASE_URL` environment variable. Connection pooling and edge-compatible driver for serverless deployment.

**Session Store**: PostgreSQL-backed session storage via `connect-pg-simple` (configured but not actively used).

### Deployment & Hosting

**Replit-Specific Features**: Runtime error modal, cartographer plugin, dev banner for development environment detection and tooling.

**Build Configuration**: 
- Client assets built to `dist/public`
- Server bundled to `dist/index.js`
- Environment-aware builds (development vs production)

### Font Delivery

**Google Fonts CDN**: Multiple font families loaded (Architects Daughter, DM Sans, Fira Code, Geist Mono, Inter, JetBrains Mono) for typography variety in design system.