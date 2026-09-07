import * as THREE from 'three';

export const ASSEMBLY_IDS = ['01','02','03','04','05','06','07','08','09'];
export const VIEW_DIRECTION = new THREE.Vector3(-12.5, 8.5, 17).normalize();
const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), VIEW_DIRECTION).normalize();
const up = new THREE.Vector3().crossVectors(VIEW_DIRECTION, right).normalize();
const center = new THREE.Vector3(1.5, 1.5, 0);
const rows = [['06','01','05'], ['04','02','07'], ['09','03','08']];
export function corners(box) {
  const result = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) result.push(new THREE.Vector3(x,y,z));
  return result;
}
export function projectedBounds(box, offset = new THREE.Vector3()) {
  const bounds = new THREE.Box2();
  for (const point of corners(box)) {
    point.add(offset).sub(center);
    bounds.expandByPoint(new THREE.Vector2(point.dot(right), point.dot(up)));
  }
  return bounds;
}
export function createExplodedLayout(assemblies) {
  const entries = new Map();
  for (const [id, entry] of assemblies) {
    const box = new THREE.Box3().setFromObject(entry.group);
    entry.bounds = box;
    entries.set(id, { box, projected: projectedBounds(box) });
  }
  const gap = 1.4;
  const heights = rows.map(row => Math.max(...row.map(id => entries.get(id).projected.getSize(new THREE.Vector2()).y)));
  let top = (heights.reduce((a,b) => a+b, 0) + gap*2) / 2;
  const offsets = new Map();
  rows.forEach((row, index) => {
    const widths = row.map(id => entries.get(id).projected.getSize(new THREE.Vector2()).x);
    let left = -(widths.reduce((a,b) => a+b,0) + gap*2) / 2;
    row.forEach((id, column) => {
      const original = entries.get(id).projected.getCenter(new THREE.Vector2());
      const x = left + widths[column]/2;
      const y = top - heights[index]/2;
      offsets.set(id, right.clone().multiplyScalar(x-original.x).addScaledVector(up,y-original.y));
      left += widths[column]+gap;
    });
    top -= heights[index]+gap;
  });
  return { offsets, entries };
}
const order = ['06','05','01','07','04','09','02','08','03'];
export function assemblyProgress(id, progress) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  const start = order.indexOf(id) * 0.045;
  const t = THREE.MathUtils.clamp((progress-start)/0.64, 0, 1);
  return t*t*t*(t*(t*6-15)+10);
}
export function fitZoom(assemblies, camera, target) {
  const view = camera.position.clone().sub(target).normalize();
  const horizontal = new THREE.Vector3().crossVectors(camera.up,view).normalize();
  const vertical = new THREE.Vector3().crossVectors(view,horizontal).normalize();
  let halfWidth = 0, halfHeight = 0;
  for (const {group, bounds} of assemblies.values()) {
    if (!group.visible) continue;
    for (const point of corners(bounds.clone().translate(group.position))) {
      point.sub(target);
      halfWidth = Math.max(halfWidth,Math.abs(point.dot(horizontal)));
      halfHeight = Math.max(halfHeight,Math.abs(point.dot(vertical)));
    }
  }
  return Math.min(1, (camera.right-camera.left)/(2*halfWidth+3), (camera.top-camera.bottom)/(2*halfHeight+3));
}
