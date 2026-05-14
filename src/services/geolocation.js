export async function checkLocation(officeLat, officeLng, radiusMeters){
  if (!navigator.geolocation) return false;
  const position = await new Promise((resolve,reject)=>{
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true});
  });
  const {latitude:lat,lng:lng} = position.coords;
  const distance = haversineDistance(lat,lng,officeLat,officeLng);
  return distance <= radiusMeters;
}

function toRad(x){return x*Math.PI/180;}
function haversineDistance(lat1,lng1,lat2,lng2){
  const R=6371000;
  const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}
