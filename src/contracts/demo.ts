import { z } from 'zod';
import { Coordinate } from './trips';

export const DEMO_PLACES_MAX = 10;

export const DemoPlace = Coordinate.extend({
  key: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(60),
});
export type DemoPlace = z.infer<typeof DemoPlace>;

export const DemoSession = z.object({
  municipality_id: z.number().int().positive(),
  municipality_name: z.string().min(1),
  center: Coordinate,
  places: z
    .array(DemoPlace)
    .max(DEMO_PLACES_MAX)
    .refine((places) => new Set(places.map((place) => place.key)).size === places.length, {
      message: 'Claves de lugar repetidas',
    }),
});
export type DemoSession = z.infer<typeof DemoSession>;
