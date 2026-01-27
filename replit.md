# TeleMarket - Telegram Bot Marketplace

## Overview

TeleMarket is a Telegram bot marketplace platform built for the Uzbek market. Users can browse, purchase, and run Telegram bots directly from the platform. The application features a modern React frontend with a Telegram-inspired design, an Express backend with PostgreSQL database, and integration with OpenAI for bot AI capabilities.

Key features:
- Bot catalog with categories, pricing, and demo links
- User authentication via Replit Auth (OpenID Connect)
- Bot instance management - users can run bots with their own Telegram tokens
- Admin panel for managing bot listings
- AI-powered Telegram bot runner with OpenAI integration

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui components (New York style)
- **Animations**: Framer Motion for page transitions
- **Build Tool**: Vite with HMR support

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/`
- Reusable components in `client/src/components/`
- Custom hooks in `client/src/hooks/`
- UI primitives from shadcn/ui in `client/src/components/ui/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session storage
- **Authentication**: Replit Auth (OpenID Connect via Passport.js)

The backend uses a modular structure:
- Routes defined in `server/routes.ts`
- Database connection in `server/db.ts`
- Storage layer in `server/storage.ts` implementing repository pattern
- Replit integrations organized in `server/replit_integrations/`

### Data Models
Located in `shared/schema.ts` and `shared/models/`:
- **bots**: Bot catalog entries (name, description, price, category, etc.)
- **botInstances**: Running bot instances linked to user tokens
- **users**: User accounts (Replit Auth)
- **sessions**: Session storage for authentication
- **conversations/messages**: Chat history for AI features

### API Design
REST API with typed routes defined in `shared/routes.ts`:
- Uses Zod for request/response validation
- Shared types between frontend and backend
- Path parameters handled via `buildUrl()` helper

### Bot Runner System
The `server/botRunner.ts` implements a Telegram bot execution engine:
- Manages multiple bot instances in memory
- Integrates with node-telegram-bot-api for Telegram connectivity
- Uses OpenAI for AI-powered bot responses
- Supports admin modes and customer data tracking

## External Dependencies

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and migrations
- **connect-pg-simple**: Session storage in PostgreSQL

### Authentication
- **Replit Auth**: OpenID Connect authentication
- Environment variables: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`

### AI Services
- **OpenAI API**: Used for bot AI capabilities
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- Supports chat completions, image generation, and audio processing

### Telegram Integration
- **node-telegram-bot-api**: For running Telegram bots
- Users provide their own bot tokens to run bot instances

### Key NPM Packages
- `@tanstack/react-query`: Data fetching and caching
- `drizzle-orm` / `drizzle-zod`: Database ORM with Zod schema generation
- `express-session`: Session handling
- `passport`: Authentication middleware
- `zod`: Schema validation
- `wouter`: Client-side routing
- Radix UI primitives: Accessible UI components