function buatkanvas(tempatKanvas,namaKanvas='canvas',lebar='200',tinggi='200'){
  document.getElementById(tempatKanvas).innerHTML="<canvas id="+namaKanvas+" width="+lebar+" height="+tinggi+"></canvas>";
  kanpas = document.getElementById(namaKanvas).getContext('2d');
  kanpas.transform(-1,1,1,1,0,Number(tinggi));
};
function persegi(idCanvas,titikAwal,panjangSisi){
	var kanvas = document.getElementById(idCanvas);
	var konteks = kanvas.getContext("2d");
  if (panjangSisi==0) return;
  konteks.beginPath();
  konteks.moveTo(titikAwal[0],titikAwal[1]);
  konteks.lineTo(titikAwal[0]+panjangSisi,titikAwal[1]);
  konteks.lineTo(titikAwal[0]+panjangSisi,titikAwal[1]-panjangSisi);
  konteks.lineTo(titikAwal[0],titikAwal[1]-panjangSisi);
  konteks.closePath();
  konteks.stroke();
};
