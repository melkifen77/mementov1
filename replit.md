# Memento - Agent Trace Visualizer

## Overview
Memento is a developer tool designed to visualize AI agent execution traces. It converts raw agent logs from various frameworks (LangChain, LangGraph, OpenAI, custom agents) into interactive visual reasoning maps, aiding developers in debugging agent behavior, understanding decision-making, and ensuring compliance. The application normalizes flexible JSON trace formats into a unified internal model, rendering them as interactive node graphs or chronological timelines with rich metadata inspection.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite for development and optimized builds.
- **UI Components**: Radix UI primitives with shadcn/ui styling (New York variant).
- **Styling**: Tailwind CSS with custom design tokens for theming, glass-morphism effects, and light/dark mode support.
- **State Management**: React hooks for local state, TanStack Query for server state (with disabled refetching).
- **Routing**: Wouter for lightweight client-side routing.
- **Visualization**: `@xyflow/react` (React Flow) for interactive node graphs, `html-to-image` for export functionality.
- **Data Flow**: User-uploaded JSON traces are normalized by `GenericAdapter` into a `TraceRun` model, then displayed in `TraceGraph` or `TimelineView`. Node selection populates `NodeInspector`.
- **Design Patterns**: Component composition, Adapter pattern for trace normalization, controlled components, ref-based DOM manipulation.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript.
- **Modes**: Supports development (Vite middleware) and production (static asset serving).
- **API Structure**: Minimal, `/api` prefix convention.
- **Storage**: In-memory storage (`MemStorage`) with an interface for future database integration.
- **Request Handling**: JSON body parsing, logging middleware, error handling.
- **Build Process**: Vite for client, esbuild for server.

### Data Storage Solutions
- **Database Configuration**: Drizzle ORM configured for PostgreSQL with Neon serverless driver.
- **Schema**: Defined in `shared/schema.ts`, migrations to `./migrations`. Minimal user table boilerplate.
- **Database Usage**: Currently stateless, processing all trace data client-side without persistence. Database infrastructure is prepared for future features like saving traces or user accounts.
- **Data Models**: `TraceNode`, `TraceRun`, `NodeType`, `IssueType`, `RiskLevel`, `TraceIssue`, `LangGraphDetails` for representing trace components and their metadata.

### Authentication and Authorization
- No authentication or authorization is currently implemented, though a user schema exists and session storage (`connect-pg-simple`) is configured, suggesting planned session-based authentication.

### Trace Normalization System
- **Adapter Pattern**: `TraceAdapter` interface for extensible parsing of different agent framework outputs.
- **Generic Adapter**: Handles arbitrary JSON structures by detecting array fields, inferring node types, extracting timestamps, and managing parent relationships.
- **Supported Formats**: Flat arrays, nested objects, LangChain `intermediate_steps`, message-based formats, tool call sequences.
- **Normalization Rules**: Type detection via keywords, parent-child inference, confidence extraction, timestamp preservation, content extraction.

## External Dependencies

### Third-Party UI Libraries
- **Radix UI Primitives**: Accessible, unstyled UI components (`@radix-ui/*`).
- **shadcn/ui**: Design system built on Radix UI with Tailwind CSS.
- **Lucide React**: Consistent SVG icon library.
- **cmdk**: Command palette/search component.
- **React Flow (@xyflow/react)**: Graph visualization library.

### Development Tools
- **Vite**: Build tool and dev server.
- **TypeScript**: Strict type checking.
- **Tailwind CSS**: Utility-first CSS framework.
- **Drizzle Kit**: Database schema management.
- **esbuild**: Fast bundler for server-side code.

### Runtime Dependencies
- **@neondatabase/serverless**: PostgreSQL client for Neon.
- **@tanstack/react-query**: Data fetching and caching library.
- **Drizzle ORM**: TypeScript ORM.
- **date-fns**: Date/time utility library.
- **wouter**: Lightweight routing library.
- **class-variance-authority & clsx**: Utility for conditional className composition.
- **html-to-image**: DOM-to-image conversion.

### Database Services
- **Neon Serverless PostgreSQL**: Cloud PostgreSQL database.
- **connect-pg-simple**: PostgreSQL-backed session storage (configured).

### Deployment & Hosting
- **Replit-Specific Features**: Runtime error modal, cartographer plugin, dev banner.

### Font Delivery
- **Google Fonts CDN**: Various font families (Architects Daughter, DM Sans, Fira Code, Geist Mono, Inter, JetBrains Mono).