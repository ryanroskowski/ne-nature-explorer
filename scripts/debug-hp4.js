const https = require('https');

// Fetch Harold Parker from Management Areas with geometry to check coverage
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Get Harold Parker from Management Areas with geometry (in WGS84)
  const mgmtUrl = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Management_Areas/FeatureServer/0/query?where=${encodeURIComponent("Unit_Nm='Harold Parker State Forest' AND State_Nm='MA'")}&outFields=OBJECTID,GIS_AcreD,FeatClass,Shape__Area&returnGeometry=true&outSR=4326&f=geojson`;

  const data = await fetchJSON(mgmtUrl);
  const features = data.features || [];
  console.log('Management Areas features for Harold Parker:', features.length);

  for (const f of features) {
    const coords = f.geometry.type === 'Polygon'
      ? f.geometry.coordinates[0]
      : f.geometry.coordinates.flat(1)[0];
    const lngs = (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(1)).flat().filter((_,i) => i%2===0);
    const lats = (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(1)).flat().filter((_,i) => i%2===1);

    // Calculate bbox
    const allCoords = [];
    function extractCoords(geom) {
      if (geom.type === 'Polygon') {
        for (const ring of geom.coordinates) for (const pt of ring) allCoords.push(pt);
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) for (const ring of poly) for (const pt of ring) allCoords.push(pt);
      }
    }
    extractCoords(f.geometry);

    const minLng = Math.min(...allCoords.map(c => c[0]));
    const maxLng = Math.max(...allCoords.map(c => c[0]));
    const minLat = Math.min(...allCoords.map(c => c[1]));
    const maxLat = Math.max(...allCoords.map(c => c[1]));

    console.log(`  OBJECTID: ${f.properties.OBJECTID}, GIS_AcreD: ${f.properties.GIS_AcreD}, FeatClass: ${f.properties.FeatClass}, Shape__Area: ${f.properties.Shape__Area}`);
    console.log(`  Type: ${f.geometry.type}, Points: ${allCoords.length}`);
    console.log(`  BBox: [${minLng.toFixed(4)}, ${minLat.toFixed(4)}] to [${maxLng.toFixed(4)}, ${maxLat.toFixed(4)}]`);

    // Calculate approximate area in acres from coordinates
    // Rough: 1 degree lat ≈ 111km, 1 degree lng ≈ 82km at 42°N
    const dLng = maxLng - minLng;
    const dLat = maxLat - minLat;
    console.log(`  Span: ${(dLng * 82).toFixed(2)}km x ${(dLat * 111).toFixed(2)}km`);
  }

  // Also get count from Management Areas with NO FeatClass restriction
  const countUrl = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Management_Areas/FeatureServer/0/query?where=${encodeURIComponent("State_Nm='MA' AND Pub_Access IN ('OA','RA') AND GIS_AcreD>=3")}&returnCountOnly=true&f=json`;
  const countData = await fetchJSON(countUrl);
  console.log('\nMA Management Areas (OA/RA, >=3 acres):', countData.count);

  // Compare to Fee layer
  const feeCountUrl = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Fee_Managers_PADUS/FeatureServer/0/query?where=${encodeURIComponent("State_Nm='MA' AND Pub_Access IN ('OA','RA') AND GIS_Acres>=3")}&returnCountOnly=true&f=json`;
  const feeCountData = await fetchJSON(feeCountUrl);
  console.log('MA Fee Managers (OA/RA, >=3 acres):', feeCountData.count);

  // Check NH Management Areas count
  const nhCountUrl = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Management_Areas/FeatureServer/0/query?where=${encodeURIComponent("State_Nm='NH' AND Pub_Access IN ('OA','RA') AND GIS_AcreD>=3")}&returnCountOnly=true&f=json`;
  const nhCountData = await fetchJSON(nhCountUrl);
  console.log('NH Management Areas (OA/RA, >=3 acres):', nhCountData.count);

  const nhFeeUrl = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Fee_Managers_PADUS/FeatureServer/0/query?where=${encodeURIComponent("State_Nm='NH' AND Pub_Access IN ('OA','RA') AND GIS_Acres>=3")}&returnCountOnly=true&f=json`;
  const nhFeeData = await fetchJSON(nhFeeUrl);
  console.log('NH Fee Managers (OA/RA, >=3 acres):', nhFeeData.count);
}

main().catch(console.error);
