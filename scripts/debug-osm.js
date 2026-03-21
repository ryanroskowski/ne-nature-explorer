const https = require('https');

// Query OSM Overpass API for Harold Parker State Forest boundary
const query = `
[out:json][timeout:30];
(
  relation["name"="Harold Parker State Forest"]["boundary"="protected_area"];
  relation["name"="Harold Parker State Forest"]["leisure"="nature_reserve"];
  way["name"="Harold Parker State Forest"]["boundary"="protected_area"];
  way["name"="Harold Parker State Forest"]["leisure"="nature_reserve"];
  relation["name"="Harold Parker State Forest"]["landuse"="forest"];
);
out geom;
`;

const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

https.get(url, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const data = JSON.parse(d);
      console.log('Elements found:', data.elements?.length || 0);
      for (const el of data.elements || []) {
        console.log(`  Type: ${el.type}, ID: ${el.id}, Tags:`, JSON.stringify(el.tags));
        if (el.bounds) {
          console.log(`  Bounds: ${el.bounds.minlat},${el.bounds.minlon} to ${el.bounds.maxlat},${el.bounds.maxlon}`);
        }
        if (el.members) {
          console.log(`  Members: ${el.members.length}`);
          // Count total geometry points
          let points = 0;
          for (const m of el.members) {
            if (m.geometry) points += m.geometry.length;
          }
          console.log(`  Total geometry points: ${points}`);
        }
      }
    } catch(e) {
      console.error('Parse error:', e.message);
      console.log('Raw response (first 500):', d.substring(0, 500));
    }
  });
}).on('error', e => console.error('Error:', e.message));
