export interface SolarSystemObject {
  id: string;
  name: string;
  type: 'planet' | 'moon' | 'asteroid' | 'comet';
  bestMonths?: number[];
  filters: string[];
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

export const solarSystemObjects: SolarSystemObject[] = [
  {
    id: 'jupiter',
    name: 'Jupiter',
    type: 'planet',
    bestMonths: [1, 2, 3, 11, 12],
    filters: ['RGB', 'CH4', 'IR'],
    priority: 'medium',
    notes: 'Great Red Spot, cloud bands, and Galilean moons visible.'
  },
  // {
  //   id: 'saturn',
  //   name: 'Saturn',
  //   type: 'planet',
  //   bestMonths: [5, 6, 7, 8],
  //   filters: ['RGB', 'CH4', 'IR'],
  //   priority: 'low',
  //   notes: 'Rings at decent angle in 2026. Cassini Division visible.'
  // },
  // {
  //   id: 'mars',
  //   name: 'Mars',
  //   type: 'planet',
  //   bestMonths: [10, 11, 12],
  //   filters: ['RGB', 'IR'],
  //   priority: 'low',
  //   notes: 'Surface features visible when near opposition.'
  // },
  // {
  //   id: 'uranus',
  //   name: 'Uranus',
  //   type: 'planet',
  //   filters: ['RGB', 'CH4'],
  //   priority: 'high',
  //   notes: 'Blue-green disk. Moons visible with 32" aperture.'
  // },
  // {
  //   id: 'neptune',
  //   name: 'Neptune',
  //   type: 'planet',
  //   filters: ['RGB', 'CH4'],
  //   priority: 'high',
  //   notes: 'Deep blue color. Triton visible.'
  // },
  // {
  //   id: 'moon',
  //   name: 'Moon',
  //   type: 'moon',
  //   filters: ['RGB', 'IR'],
  //   priority: 'low',
  //   notes: 'Best near first/last quarter for crater detail.'
  // }
];
