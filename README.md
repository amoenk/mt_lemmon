# Mt. Lemmon Observer

A web-based observation planning tool for the Mt. Lemmon Sky Center 32" telescope in Arizona. Calculate object visibility, schedule observations, and optimize your imaging session.

## Features

- **Real-time altitude calculations** - See which objects are visible during your observation window
- **Smart scheduling** - Automatically schedules objects based on transit times and priorities  
- **Gantt chart visualization** - Visual timeline showing when each object is observable
- **Mobile-friendly** - Fully responsive design for planning in the field
- **Imaging recommendations** - Exposure times, filter sequences, and settings for a 32" f/5 telescope
- **Import/Export** - Share observation plans with others via URL or text format

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to start planning.

## Production

Deployed at [mtlemmon.vercel.app](https://mtlemmon.vercel.app)

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- astronomy-engine for calculations
- Vercel for hosting

## Data

Includes curated catalog of:
- Deep sky objects (galaxies, nebulae, clusters)
- Solar system objects
- Optimized for 32" telescope capabilities

## Contributing

Pull requests welcome! Please keep in mind this is optimized for the specific location and equipment at Mt. Lemmon Sky Center (32.44°N, 110.79°W, elevation 2791m).

## License

MIT