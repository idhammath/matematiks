function buatkanvas(tempatKanvas,namaKanvas='canvas',lebar='200',tinggi='200'){
  document.getElementById(tempatKanvas).innerHTML="<canvas id="+namaKanvas+" width="+lebar+" height="+tinggi+"></canvas>";
	this.namakanvas=namaKanvas;
	this.tempatkanv=tempatKanvas;
};
function persegi(kanv,titikAwal,panjangSisi){
	var kanvas = document.getElementById(kanv.namakanvas);
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
