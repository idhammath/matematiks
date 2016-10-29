function buatkanvas(tempatKanvas,namaKanvas='canvas',lebar='200',tinggi='200'){
  document.getElementById(tempatKanvas).innerHTML="<canvas id="+namaKanvas+" width="+lebar+" height="+tinggi+"></canvas>";
	this.namakanvas=namaKanvas;
	this.tempatkanv=tempatKanvas;
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
function segitiga(idCanvas,titikA,titikB,titikC){
	kanv = document.getElementById(idCanvas);
	ktks = kanv.getContext('2d');
	ktks.beginPath();
	ktks.moveTo(titikA[0],titikA[1]);
	ktks.lineTo(titikB[0],titikB[1]);
	ktks.lineTo(titikC[0],titikC[1]);
	ktks.closePath();
	ktks.stroke();
};
