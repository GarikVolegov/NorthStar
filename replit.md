# Orientamento — SaaS di Orientamento e Crescita Personale

## Overview

Orientamento is a freemium SaaS platform designed for Italian users to discover their ideal career path. It integrates a RIASEC-based personality test with the "Five Spirits" inner compass to provide a comprehensive understanding of a user's external skills/interests and internal energy/will/vision. The platform then recommends compatible career sectors, backed by real data. The project's vision is to become the leading personal and career growth platform in Italy, empowering individuals with data-driven insights and AI-powered tools for self-discovery and professional development.

## User Preferences

I want iterative development and detailed explanations. I want to be asked before major changes are made.

## System Architecture

The project employs a monorepo structure using pnpm workspaces, separating concerns into distinct artifacts: an Express 5 API backend, a React + Vite frontend, a Python FastAPI AI microservice (LangChain/LangGraph), and a UI component prototyping sandbox.

### UI/UX Decisions
- **Frontend Framework:** React 19 with Vite for fast development.
- **Styling:** Tailwind CSS v4 for utility-first styling, complemented by Radix UI for accessible components.
- **Routing:** Wouter for a lightweight routing solution.
- **Data Visualization:** Recharts for interactive data and trend charts.
- **Iconography:** Lucide icons.
- **PWA:** Configured with `vite-plugin-pwa` for an installable experience on mobile and desktop, including precaching and runtime caching strategies.
- **Skeleton Screens:** Implemented shared skeleton components for various sections (news, sectors, results) to improve perceived loading performance.
- **Error Boundaries:** A global `ErrorBoundary` component wraps all routes, providing a localized fallback UI and retry options for render crashes.
- **Lazy Loading:** All pages utilize `React.lazy()` and `Suspense` with a `<PageLoader />` fallback for optimized bundle splitting and faster initial load times.

### Technical Implementations
- **API Strategy:** OpenAPI-first approach with Orval for client and Zod schema generation, ensuring strong type safety and consistency between frontend and backend.
- **State Management:** TanStack React Query for efficient data fetching, caching, and synchronization, configured with exponential backoff retry logic.
- **Database:** PostgreSQL managed via Drizzle ORM. The schema includes `sectors`, `professions`, `education_paths`, `test_sessions`, `users`, `user_objectives`, `user_favorites`, `news_articles`, `agent_runs`, `agent_suggestions`, `review_queue`, `audit_logs`, and `knowledge_nodes`/`knowledge_edges` for the personal knowledge graph.
- **Authentication:** JWT-based authentication with persistent secrets to maintain user sessions across server restarts. Includes secure verification codes and improved email deliverability feedback.
- **Form Validation:** Migration to React Hook Form with Zod for robust, inline form validation across key user flows (registration, contact, password change).

### Feature Specifications
- **Core Test:** A 17-question test (12 RIASEC + 5 Cinque Spiriti) leads to a personalized results page displaying RIASEC profile, inner compass insights, and top 3 career sector recommendations with match scores.
- **Five Spirits System:** A secondary personality layer (Shen, Hun, Po, Yi, Zhi) influences sector matching by boosting RIASEC scores based on user's dominant spirit.
- **AI Microservice:** A Python FastAPI service orchestrates various AI agents (PersonalityInsight, SectorMotivation, WorkModeAdvisor, AffiliationMaterials, CareerChat) using LangChain and LangGraph. It runs on port 8000 and is proxied by the Express backend.
- **Premium AI Features:**
    - **Wiki AI:** A streaming chat interface acting as an expert on specific career sectors.
    - **Personalized Roadmap:** AI-generated multi-path roadmaps for career entry into a sector, tailored to user preferences and test results.
    - **Personal Knowledge Graph:** An Obsidian-like, persistent knowledge graph allowing users to store and connect notes, skills, and documents. Features RAG (Retrieval-Augmented Generation) for querying the graph, providing answers with citations from user's nodes.
- **News Module:** Fetches career news, either live from GNews API (if API key is present) or from static curated content, with premium sector-specific news.
- **Research Scheduler:** Automated agents (`news-research`, `growth-research`) use Tavily AI Web Search to periodically fetch and store career news and generate growth articles.
- **Admin Review Dashboard:** A backoffice interface for reviewing and managing AI agent outputs and suggestions before publication, including workflow for approvals, rejections, and audits.
- **AI Interview Simulator (Feature 1):** Streaming mock interview with sector-specific HR questions, per-answer feedback, and a final score /100 after 5 turns. Route: `/colloquio/:id`.
- **Skills Gap Analysis (Feature 2):** Users select current skills, get an AI-powered gap report vs. sector requirements with a Readiness Index (0-100). Route: `/skills-gap/:id`.
- **Career Coach AI (Feature 3):** Persistent multi-session AI coach with sidebar session management, streaming chat, quick-start prompts. Route: `/coach`. DB: `coach_sessions` table.
- **Admin Metrics Dashboard (Feature 4):** Password-protected admin dashboard at `/admin/metriche` showing KPIs (users, premium, MRR, tests), daily signups chart, top sectors bar chart.
- **Onboarding Modal (Feature 5):** 4-step post-test onboarding modal (results, sector pick, first objective, next steps). Shows once per browser via localStorage.
- **Objectives Kanban (Feature 6):** Drag-and-drop Kanban board (Da fare / In corso / Completati) in profilo.tsx with progress sliders, overdue highlighting.
- **Profile Share Card (Feature 7):** SVG profile card endpoint at `/og/profile-card/:userId` with RIASEC types, sector name, dominant spirit.
- **Rate Limiting (Feature 8):** `aiChatRateLimiter` (20/hr free, 500/hr premium) and `aiGenerationRateLimiter` (5/hr free, 50/hr premium) applied to wiki, roadmap, knowledge, interview, skills-gap, and coach routes.
- **Weekly Digest Email (Feature 9):** Scheduler that sends Monday 8am (Rome time) HTML digest emails with sector news and upcoming objectives. Disabled if `RESEND_API_KEY` not set.
- **14 Additional Sectors (Feature 10):** Seed expanded to 28 total sectors: Architettura, Ricerca & Accademia, Agricoltura & AgriTech, Energia & Green Economy, Sport & Performance, Logistica, Media & Giornalismo, Moda & Lusso, Diritto & Compliance, Farmaceutico, Psicologia, Elettronica, No Profit, Intelligenza Artificiale & ML.

## External Dependencies

- **Database:** PostgreSQL
- **Payments:** Stripe (for subscription management and checkout)
- **Large Language Models (LLM):** OpenAI (accessed via Replit AI Integrations proxy)
- **Web Search API:** Tavily AI Web Search (for news and growth article research)
- **Email Service:** Resend (for sending transactional emails)
- **Frontend Libraries:** React, Vite, Tailwind CSS, Wouter, TanStack React Query, Recharts, Lucide, Radix UI, Framer Motion (for animations)
- **Backend Libraries:** Express, TypeScript, Pino (logging), Drizzle ORM, LangChain, LangGraph, FastAPI