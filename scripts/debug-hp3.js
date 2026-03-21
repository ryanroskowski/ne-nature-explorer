const https = require('https');

// Check PADUS_Protected_Areas_States layer
function query(serviceName, where, label) {
  return new Promise((resolve) => {
    const url = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/${serviceName}/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=*&returnGeometry=false&f=json&resultRecordCount=5`;
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          console.log(`\n=== ${label} (${serviceName}) ===`);
          if (j.error) { console.log('Error:', j.error.message); resolve(); return; }
          const features = j.features || [];
          console.log(`Features: ${features.length}`);
          for (const f of features) {
            console.log(JSON.stringify(f.attributes));
          }
        } catch(e) { console.log(`${label}: parse error`); }
        resolve();
      });
    }).on('error', () => { console.log(`${label}: network error`); resolve(); });
  });
}

async function main() {
  // Check various PAD-US layers for Harold Parker or state forest boundaries
  await query('PADUS_Management_Areas', "Unit_Nm LIKE '%Harold Parker%'", 'Management Areas');
  await query('Manager_Name_PADUS', "Unit_Nm LIKE '%Harold Parker%'", 'Manager Name');
  await query('PADUS_Designation_Manager_Types', "Unit_Nm LIKE '%Harold Parker%'", 'Designation Manager Types');

  // Also check if there's an OpenStreetMap overpass possibility - check bbox for protected areas
  // Check how many features the Management Areas layer has for MA state forests
  await query('PADUS_Management_Areas', "State_Nm='MA' AND Des_Tp='SRMA'", 'MA State Resource Mgmt Areas');
}

main();
