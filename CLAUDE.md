# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mt. Lemmon Observer - A React TypeScript application for planning astronomical observations at Mt. Lemmon Observatory in Arizona. The app calculates object visibility, moon phases, and optimal observation times for both deep sky and solar system objects.

## Development Commands

```bash
npm run dev       # Start development server with Vite HMR
npm run build     # TypeScript check and production build
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

## Architecture

### Core Components
- **ObservationPlanner** (`src/components/ObservationPlanner.tsx`): Main UI component that handles date/time selection, filtering, and displays visible astronomical objects sorted by priority and altitude.

### Data Models
- **Deep Sky Objects** (`src/data/deepSkyObjects.ts`): Catalog of galaxies, nebulae, and clusters with RA/Dec coordinates, magnitude, and observation priorities.

### Astronomy Utilities
- **astronomy.ts** (`src/utils/astronomy.ts`): Core astronomical calculations using the astronomy-engine library:
  - Coordinate conversions (RA/Dec to Alt/Az)
  - Object visibility calculations
  - Moon phase calculations
  - Transit time predictions

### Key Constants
- **Mt. Lemmon Location**: Latitude 32.4433°N, Longitude 110.7892°W, Elevation 2791m
- **Default observation date**: the next moonless night from today (at most 30 minutes of moonlight during astronomical dark)
- **Default observation window**: astronomical dark for the selected date (Sun 18° below the horizon)
- **Minimum altitude threshold**: 15° above horizon (configurable)

## Tech Stack
- React 19 with TypeScript
- Vite for build tooling
- astronomy-engine for astronomical calculations
- date-fns for date manipulation
- ESLint for code quality