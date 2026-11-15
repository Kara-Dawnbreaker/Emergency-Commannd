# Emergency-Commannd

A single-player emergency operations and management simulator built around a living modern city.

## Current development build 0.2

This is an active systems prototype, not the final game.

### Playable systems
- Expanded low-poly city district with four named districts, roads, parks and service stations.
- Three response services: fire, police and medical.
- Six dispatchable vehicles with service-specific availability.
- Five incident categories, three severity levels and automatic incident escalation.
- Nearest available matching unit is selected automatically when dispatching.
- Units travel to incidents, arrive, handle the call and return to base.
- City clock, pause, simulation speed, operating funds and reputation.
- Live incident queue and radio event log.
- Click city buildings to inspect their district and active call.

## Development
- TypeScript, Three.js, Vite
- Run with Node.js 20.19+ or 22.12+: `npm install`, then `npm run dev`.
- Validate with `npm run typecheck` and `npm run build`.

The next development milestones are improved routing and traffic, richer incident chains, city resilience and damage, station and fleet management, save/load, and browser deployment.