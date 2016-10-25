function buatkanvas(tempatKanvas,namaKanvas='canvas',lebar='200',tinggi='200'){
  document.getElementById(tempatKanvas).innerHTML="<canvas id="+namaKanvas+" width="+lebar+" height="+tinggi+"></canvas>";
  kanpas = document.getElementById(namaKanvas).getContext('2d');
  kanpas.transform(-1,1,1,1,0,Number(tinggi));
}
