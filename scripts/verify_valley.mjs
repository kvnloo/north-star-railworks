import assert from 'node:assert/strict';
import * as THREE from 'three';
import {railPoint, route, routeLength, terrainHeight, distanceToRail} from '../web/valley/geography.js';

const failures = [];
function check(name, condition, detail) {
  if (!condition) failures.push(`${name}: ${detail}`);
}
function finiteVector(v) {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
function nearestRoute(t, point) {
  let best = {distance: Infinity, t: 0, point: null};
  for (let i = 0; i < 2400; i++) {
    const u = i / 2400;
    const p = route.getPointAt(u);
    const d = p.distanceToSquared(point);
    if (d < best.distance * best.distance) best = {distance: Math.sqrt(d), t: u, point: p};
  }
  return best;
}

// The closed spline is a contract for every train, camera, and scenery consumer.
const start = route.getPointAt(0);
const end = route.getPointAt(1);
check('route closure', start.distanceTo(end) < 1e-5,
  `start ${start.toArray()} differs from end ${end.toArray()}`);
check('route length', Number.isFinite(routeLength) && routeLength > 100,
  `routeLength=${routeLength}`);
for (let i = 0; i <= 720; i++) {
  const t = i / 720;
  const p = route.getPointAt(t);
  const tangent = route.getTangentAt(t);
  check('route finite', finiteVector(p) && finiteVector(tangent),
    `t=${t} point=${p.toArray()} tangent=${tangent.toArray()}`);
}

// Two centerlines should remain parallel and six units apart through the loop.
for (let i = 0; i <= 720; i++) {
  const t = i / 720;
  const a = railPoint(t, 0);
  const b = railPoint(t, 1);
  const separation = a.distanceTo(b);
  check('rail line separation', Math.abs(separation - 6) < 0.03,
    `t=${t} line0=${a.toArray()} line1=${b.toArray()} separation=${separation}`);
}

// Terrain must stay below the rail and both steel rails, including around bends.
for (const line of [0, 1]) {
  for (let i = 0; i < 1440; i++) {
    const t = i / 1440;
    const center = railPoint(t, line);
    const tangent = route.getTangentAt(t);
    for (const side of [-0.92, 0.92]) {
      const p = center.clone().add(new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(side));
      const terrain = terrainHeight(p.x, p.z);
      check('track above terrain', terrain <= p.y - 0.08,
        `line=${line} t=${t} rail=${p.toArray()} terrain=${terrain}`);
    }
  }
}

// The arch is centred at (y,z)=(3.6,-84), with a 6.7-unit inner radius.
// Limit the check to the northern approach segment; the loop also passes x=0
// in the town, far outside the tunnel.
for (const line of [0, 1]) {
  for (let i = 0; i < 2400; i++) {
    const t = i / 2400;
    const tangent = route.getTangentAt(t);
    const center = railPoint(t, line);
    if (Math.abs(center.x) > 29 || center.z > -60) continue;
    for (const side of [-0.92, 0.92]) {
      const rail = center.clone().add(new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(side));
      const radius = Math.hypot(rail.y - 3.6, rail.z + 84);
      check('tunnel rail clearance', radius <= 6.58,
        `line=${line} t=${t} rail=${rail.toArray()} radial=${radius}`);
    }
  }
}

// Ravenfell's long platform is deliberately parallel to the east-west track.
// Pinewatch is generated from route t=.10 and should sit seven units outward.
const junction = new THREE.Vector3(5, 4, 92);
const junctionNear = nearestRoute(0, junction);
check('Ravenfell station reaches track', junctionNear.distance <= 7.5,
  `station=${junction.toArray()} nearestTrack=${junctionNear.point.toArray()} distance=${junctionNear.distance}`);
const junctionTangent = route.getTangentAt(junctionNear.t);
check('Ravenfell station alignment', Math.abs(junctionTangent.x) >= 0.95,
  `nearest t=${junctionNear.t} tangent=${junctionTangent.toArray()}`);

const pineT = 0.10;
const pineTangent = route.getTangentAt(pineT);
const pine = railPoint(pineT).add(new THREE.Vector3(pineTangent.z, 0, -pineTangent.x).multiplyScalar(7));
check('Pinewatch outward siting', Math.abs(distanceToRail(pine.x, pine.z) - 7) < 0.05,
  `station=${pine.toArray()} distanceToRail=${distanceToRail(pine.x, pine.z)}`);
const pineFacing = new THREE.Vector3(Math.cos(Math.atan2(-pineTangent.z, pineTangent.x)), 0,
  -Math.sin(Math.atan2(-pineTangent.z, pineTangent.x)));
check('Pinewatch station alignment', Math.abs(pineFacing.dot(pineTangent)) > 0.995,
  `station=${pine.toArray()} tangent=${pineTangent.toArray()} facing=${pineFacing.toArray()}`);
for (const [name, p] of [['Ravenfell', junction], ['Pinewatch', pine]]) {
  check(`${name} platform above terrain`, terrainHeight(p.x, p.z) <= p.y - 0.08,
    `station=${p.toArray()} terrain=${terrainHeight(p.x, p.z)}`);
}

if (failures.length) {
  console.error(`Valley geometry verification failed (${failures.length} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  assert.equal(failures.length, 0);
  console.log('Valley geometry verification passed: route, rails, terrain, tunnel, and stations.');
}
