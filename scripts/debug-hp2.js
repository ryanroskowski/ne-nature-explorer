// Check ALL Harold Parker parcels including closed access and any FeatClass
const https = require('https');
const url = 'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Fee_Managers_PADUS/FeatureServer/0/query?where=Unit_Nm%20LIKE%20%27%25Harold%20Parker%25%27&outFields=Unit_Nm,GIS_Acres,Own_Type,Pub_Access,FeatClass,Loc_Own&returnGeometry=false&f=json';
https.get(url, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    const features = j.features || [];
    console.log('ALL Harold Parker parcels (any access):', features.length);
    let totalAcres = 0;
    for (const f of features) {
      const a = f.attributes;
      totalAcres += a.GIS_Acres || 0;
      console.log(`  ${a.GIS_Acres} acres, access: ${a.Pub_Access}, class: ${a.FeatClass}`);
    }
    console.log('Total acres:', totalAcres);

    // Also check for easements in the same bbox
    const url2 = 'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Fee_Managers_PADUS/FeatureServer/0/query?where=1%3D1%20AND%20FeatClass%3D%27Easement%27&geometry=%7B%22xmin%22%3A-71.10%2C%22ymin%22%3A42.59%2C%22xmax%22%3A-71.04%2C%22ymax%22%3A42.65%7D&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=Unit_Nm,GIS_Acres,Pub_Access,FeatClass&returnGeometry=false&f=json&returnCountOnly=true';
    https.get(url2, res2 => {
      let d2 = '';
      res2.on('data', c => d2 += c);
      res2.on('end', () => {
        console.log('\nEasements in Harold Parker bbox:', JSON.parse(d2));
      });
    });
  });
});
