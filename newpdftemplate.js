function getRow(row) {
	var imageUrl = row[0];
	if(imageUrl == '' || imageUrl === undefined)
		imageUrl = 'https://ambeerenginefileupload.s3.amazonaws.com/no-thumb.png';
	var rowHTML = `
    <tr>
    <td style="padding: 5px; border:solid 1px #222;">
    <div style="max-width:100px; height:40px; margin:auto;">
    <img style="width:100%; height:100%;" src="` + imageUrl + `">
</div>
    </td>`;

	/*     <div style="max-width:100px; height:40px; margin:auto;">
        <img style="width:100%; height:100%;" src="` + row[0] + `">
    </div> */
	row.map((val, idx) => {
		if (idx > 0)
			rowHTML += '<td style="padding: 5px; border:solid 1px #222;">' + val + '</td>';
	});
	rowHTML += '</tr>';
	return rowHTML;
}

function getCol(cols) {
	var colHTML = `<tbody style="font-size: 11px; text-transform: uppercase;">
    <tr style="background-color: #bfbfbf;">`;
	cols.map((col) => {
		colHTML += `
        <td style="padding: 10px; border:solid 1px #222;"> 
            <strong>` + col + `</strong>
        </td>`;
	});
	colHTML += '</tr>';
	return colHTML;
}

module.exports.pdfhtmlTable = function (data) {
	var totalHTML = `
<html>
<head>
    <title>Amber Engine - PDF Report</title>
    <style>
  html {
    -webkit-print-color-adjust: exact;
  }
</style>
</head>
<body style="margin: 0; font-family: Verdana, Geneva, sans-serif;">`;
	var rowsPerPage = 11;
	for(var i=0; i<data.rows.length; i+= rowsPerPage){
		totalHTML += `    <div style="margin: 5mm 5mm 15mm 5mm; display: block; position: relative;page-break-after:always;">
        <table style="width: 100%; text-align: center; border-collapse: collapse; overflow-x:auto;">
            <tbody style="font-size: 11px; text-transform: uppercase;">
                <tr style="border-width: 1px 1px 0 1px; border-style: solid; border-color: #222;">
                    <td style="text-align:left;  padding: 10px;">
                        <h1 style="margin:0; font-size:20px;">` + data.orgname + `</h1>
                        <p>` +data.orgaddress + `</p>
                    </td>
                    <td style="padding: 10px; position:relative; height:70px;" align="right">
                    <div style="max-width:100px; height:100px; position:absolute; top:10px; right: 10px;">
                    <img style="width:100%; height:75%;" src="` + data.orgurl + `">
                     </div> 
                    </td>
                </tr>
            </tbody>
        </table>
        <table style="width: 100%; text-align: center; border-collapse: collapse;">`;
		/*         <div style="max-width:100px; height:50px;">
                <img style="width:100%; height:100%;" src="` + data.orgurl +`">
            </div> */
		totalHTML += getCol(data.cols);
		var tempData = data.rows.slice(i, i+rowsPerPage);
		tempData.map((row) => {
			totalHTML += getRow(row);
		});
		totalHTML += `
            </tbody>
        </table>
        
    </div>`;
	}
	totalHTML += `
    <div style="position:fixed; bottom:50px; text-align:center; width:100%;">
            <p style="font-size: 12px; letter-spacing: 3px; color: #636161; max-width: 300px; margin:auto; line-height: 20px;"></p>
        </div>
    </body>
</html>
`;
	return totalHTML;
};
function getBrochureRows(data) {
	var rows = data.rows;
	var cols = data.cols;
	var tableHTML = '';
	rows.map((row) => {
		var rowHTML = `<br /><div style="page-break-after:always;"><div style="margin: 5mm 5mm 15mm 5mm; display: block; position: relative;"> 
        <table style="width: 100%; border-collapse: collapse;">
        <tbody style="font-size: 11px; text-transform: uppercase;">
            <tr style="border-bottom: solid 2px #b7b7b7;">
                <td style="background:url('https://petram-vesper-dev-upload.s3-ap-southeast-1.amazonaws.com/header-bg.png') no-repeat; color:#fff; height: 80px; text-align: left; padding: 20px; vertical-align: bottom; font-size: 20px; background-size: cover; width:95%">` + data.orgname + `</td>
                <td style="padding:15px;">
                    <div style="width:100px; height:auto; margin:auto;"><img src="` +  data.orgurl  +  `" style="max-width: 100%; max-height:100%;"></div>
                </td>
            </tr>
            <tr>
                <td colspan="2" style="padding:25px; text-align: center;">
                    <div style="width:200px; height:auto; margin: auto;"><img src="logo.jpg" style="max-width: 100%; max-height:100%;"></div>
                </td>
            </tr>
        </tbody>
    </table>
        <table style="width: 100%; border-collapse: collapse; border:solid 1px #ddd;page-break-after:always;">
        <tbody style="font-size: 11px; text-transform: uppercase;">`;
		row.map((elem, index) => {
			if (cols[index].toLowerCase().trim() === 'image') {
				var imageUrl = elem;
				if(imageUrl == '' || !imageUrl)
					imageUrl = 'https://ambeerenginefileupload.s3.amazonaws.com/no-thumb.png';
				rowHTML += `
                <tr style="border-bottom: solid 1px #ddd;">
                <td colspan="2" style="padding:25px; text-align: center;">
                    <div style="width:200px; height:auto; margin: auto;"><img src="` + imageUrl + `" style="max-width: 100%; max-height:100%;"></div>
                </td>
            </tr>`;
			}
			else if (cols[index].toLowerCase().trim() === 'images') {
				rowHTML += `<tr style="border-bottom:solid 1px #ddd;">
                <td style="padding:15px 20px; border-right: solid 1px #ddd; width:30%;">Images</td>
                <td style="vertical-align:bottom; line-height:22px; text-align: justify; padding:15px 20px;">`;
				var images = elem;
				for (var i = 0; i < images.length; i++) {
					rowHTML += `
                    <div style="max-width:80px; height:80px; margin:0 10px 15px; display: inline-block;">
                    <img style="width:100%; height:100%; border-radius: 5px;" src=" ` +  images[i] +   `">
                </div>`;
				}
				rowHTML += `</td>
                        </tr>`;
			}
			else {
				rowHTML += `
                <tr style="border-bottom: solid 1px #ddd;">
                   <td style="padding:15px 20px; border-right: solid 1px #ddd; width:30%;">` + cols[index]  +   `</td>
                   <td style="padding:15px 20px;">` + elem + `</td>
                </tr>
                `;
			}
		});
		rowHTML += `</tbody>
        </table>
        </div>
        </div>`;
		tableHTML += rowHTML;
	});
	return tableHTML;
}
module.exports.pdfhtmlBrochure = function (data) {
	var totalHTML = `
    <html>
<head>
    <title>Amber Engine - PDF Report</title>
    <style>
        html {
          -webkit-print-color-adjust: exact;
        }
      </style>
</head>
<body style="margin: 0; font-family: Verdana, Geneva, sans-serif;">
    `;
	totalHTML += getBrochureRows(data);
	totalHTML += `
    <div style="position:fixed; bottom:50px; text-align:center; width:100%;">
    <p style="font-size: 12px; letter-spacing: 3px; color: #636161; max-width: 300px; margin:auto; line-height: 20px;">` + data.orgaddress + `</p>
</div>
</body>
</html>`;

	return totalHTML;
};

/*        */