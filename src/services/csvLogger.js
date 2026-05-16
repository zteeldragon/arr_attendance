let logs = [];

export function logAttendance(id, timestamp){
  logs.push({id,timestamp});
}

export function downloadCSV(){
  const header="ID,Time\n";
  const rows=logs.map(l=>`${l.id},${l.timestamp}`).join("\n");
  const csv = header+rows;
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link=document.getElementById('download-link');
  if(link){
    link.href=url;
    link.style.display='block';
  }
}
