import heritage from '../templates/heritage.json';
import commodore from '../templates/commodore.json';
const templates = { heritage, commodore };
const base = `${import.meta.env.BASE_URL}generated/`;
const source = 'https://github.com/kvnloo/north-star-railworks/blob/main/';
let revision = 0;
export async function selectStudy(slug) {
  const token = ++revision;
  const template = templates[slug];
  document.querySelectorAll('[data-study]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.study === slug)));
  for (const [id, path, description] of [
    ['study-image', `studies/${slug}-notebook.png`, 'explanatory notebook drawing'],
    ['finished-image', `${slug}.png`, 'finished Blender render'],
    ['parts-image', `${slug}-exploded.png`, 'exploded assembly render'],
  ]) {
    const image = document.getElementById(id);
    image.src = `${base}previews/${path}`;
    image.alt = `${template.title}, ${description}`;
  }
  document.getElementById('recipe-label').textContent = `templates/${slug}.json`;
  document.getElementById('recipe-code').textContent = JSON.stringify({ builder: template.builder, drivers: template.drivers, frame_length: template.frame_length, tender_length: template.tender_length, cab_number: template.cab_number }, null, 2);
  document.getElementById('template-link').href = `${source}templates/${slug}.json`;
  document.getElementById('finished-label').textContent = template.title.toUpperCase();
  document.getElementById('finish-copy').textContent = slug === 'heritage' ? 'Forest green and brass emphasize the separate boiler, domes, and running gear. The frame was shortened during review to keep the front proportions compact.' : 'Midnight blue and silver turn the same basic vocabulary into a streamlined silhouette. Review focused on the tapered nose, headlamp placement, and surfaces around the wheel arches and lettering.';
  const downloads = document.getElementById('part-downloads');
  downloads.replaceChildren();
  try {
    const response = await fetch(`${base}models/${slug}/manifest.json`);
    if (!response.ok) throw new Error('Manifest unavailable');
    const manifest = await response.json();
    if (token !== revision) return;
    document.getElementById('parts-label').textContent = `${manifest.object_count.toLocaleString()} EDITABLE OBJECTS`;
    for (const name of Object.keys(manifest.assemblies).sort()) {
      const title = name.split(' • ')[1];
      const link = document.createElement('a');
      link.href = `${base}models/${slug}/${title.toLowerCase().replaceAll(' ', '-')}.glb`;
      link.download = '';
      link.textContent = `${title} ↓ GLB`;
      downloads.append(link);
    }
  } catch {
    if (token === revision) downloads.textContent = 'Assembly downloads are also available in the source repository.';
  }
}

