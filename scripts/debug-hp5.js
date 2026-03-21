const https = require('https');

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
  // Check ALL FeatClass values for Harold Parker in Management Areas
  const url1 = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Management_Areas/FeatureServer/0/query?where=${encodeURIComponent("Unit_Nm='Harold Parker State Forest' AND State_Nm='MA'")}&outFields=OBJECTID,FeatClass,GIS_AcreD,Own_Type,Pub_Access,Des_Tp,Shape__Area&returnGeometry=false&f=json`;
  const data1 = await fetchJSON(url1);
  console.log('=== ALL Harold Parker in Management Areas ===');
  for (const f of data1.features || []) {
    const a = f.attributes;
    const calcAcres = (a.Shape__Area / 4046.86).toFixed(1);
    console.log(`  OID:${a.OBJECTID} FeatClass:${a.FeatClass} GIS_AcreD:${a.GIS_AcreD?.toFixed(1)} CalcAcres:${calcAcres} Own:${a.Own_Type} Access:${a.Pub_Access} Des:${a.Des_Tp}`);
  }

  // Check if there's a Designation feature class for MA state forests
  const url2 = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Management_Areas/FeatureServer/0/query?where=${encodeURIComponent("State_Nm='MA' AND FeatClass='Designation'")}&outFields=Unit_Nm,GIS_AcreD,Des_Tp&returnGeometry=false&f=json&resultRecordCount=10`;
  const data2 = await fetchJSON(url2);
  console.log('\n=== MA Designation features ===');
  for (const f of data2.features || []) {
    const a = f.attributes;
    console.log(`  ${a.Unit_Nm}: ${a.GIS_AcreD?.toFixed(1)} acres, Des_Tp: ${a.Des_Tp}`);
  }

  // Check what FeatClass values exist
  const url3 = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Management_Areas/FeatureServer/0/query?where=${encodeURIComponent("State_Nm='MA'")}&outFields=FeatClass&returnGeometry=false&f=json&returnDistinctValues=true&resultRecordCount=20`;
  const data3 = await fetchJSON(url3);
  console.log('\n=== Distinct FeatClass values for MA ===');
  for (const f of data3.features || []) {
    console.log(`  ${f.attributes.FeatClass}`);
  }

  // Check Proclamation layer for MA state forests specifically
  const url4 = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Proclamation_and_Other_Planning_Boundaries_PADUS/FeatureServer/0/query?where=${encodeURIComponent("Unit_Nm LIKE '%Harold Parker%'")}&outFields=Unit_Nm,GIS_Acres,Des_Tp,Own_Type&returnGeometry=false&f=json`;
  const data4 = await fetchJSON(url4);
  console.log('\n=== Harold Parker in Proclamation layer ===');
  console.log('Features:', (data4.features || []).length);
  for (const f of data4.features || []) {
    console.log(`  ${f.attributes.Unit_Nm}: ${f.attributes.GIS_Acres} acres`);
  }

  // Check combined layer
  const url5 = `https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Management_Areas/FeatureServer/0/query?where=${encodeURIComponent("State_Nm='MA' AND FeatClass NOT IN ('Fee','Easement') AND GIS_AcreD>=100")}&outFields=Unit_Nm,GIS_AcreD,FeatClass,Des_Tp&returnGeometry=false&f=json&resultRecordCount=20`;
  const data5 = await fetchJSON(url5);
  console.log('\n=== MA non-Fee/Easement features >=100 acres ===');
  for (const f of data5.features || []) {
    const a = f.attributes;
    console.log(`  ${a.Unit_Nm}: ${a.GIS_AcreD?.toFixed(1)} acres, FeatClass: ${a.FeatClass}, Des_Tp: ${a.Des_Tp}`);
  }
}

main().catch(console.error);
