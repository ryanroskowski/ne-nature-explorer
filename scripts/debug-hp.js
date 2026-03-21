const https = require('https');
const url = 'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Fee_Managers_PADUS/FeatureServer/0/query?where=1%3D1&geometry=%7B%22xmin%22%3A-71.12%2C%22ymin%22%3A42.57%2C%22xmax%22%3A-71.02%2C%22ymax%22%3A42.66%7D&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=Unit_Nm,GIS_Acres,Own_Type,Pub_Access,Loc_Own&returnGeometry=false&f=json&resultRecordCount=2000';
https.get(url, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    const features = j.features || [];
    console.log('Total features in bbox:', features.length);
    const groups = {};
    for (const f of features) {
      const name = f.attributes.Unit_Nm || 'null';
      if (!groups[name]) groups[name] = { count: 0, acres: 0, accessSet: {}, owner: '' };
      groups[name].count++;
      groups[name].acres += f.attributes.GIS_Acres || 0;
      groups[name].accessSet[f.attributes.Pub_Access] = true;
      groups[name].owner = f.attributes.Loc_Own || '';
    }
    const sorted = Object.entries(groups).sort((a,b) => b[1].acres - a[1].acres);
    for (const [name, info] of sorted.slice(0, 30)) {
      console.log(`${name}: ${info.count} parcels, ${info.acres} acres, access: ${Object.keys(info.accessSet).join(',')}, owner: ${info.owner}`);
    }
  });
});
