# SmartSeen Frontend

React + TypeScript + Vite frontend for the SmartSeen accounting, HR & employee recognition platform.

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Start the development server:
```bash
yarn dev
```

The frontend will be available at: http://localhost:5173

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VITE_API_URL`: Backend API URL (default: http://localhost:8083/api/v1)

## Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn lint` - Run ESLint
- `yarn test` - Run tests
- `yarn test:coverage` - Run tests with coverage

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Client-side routing
- **React Query** - Server state management
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **Axios** - HTTP client

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── lib/           # Utilities and API client
├── App.tsx        # Main app component
├── main.tsx       # App entry point
└── index.css      # Global styles
```