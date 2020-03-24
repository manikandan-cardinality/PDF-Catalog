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
                <tr>
                    <td style="text-align:left;  padding: 10px;">
                        <h1 style="margin:0; font-size:20px;">` + data.orgname + `</h1>
                    </td>
                    <td style="padding: 10px; position:relative; height:70px;" align="right">
                    <div style="max-width:100px; height:50px; position:absolute; top:10px; right: 10px;">
                    <img style="width:100%; height:100%;" src="` + data.orgurl + `">
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
            <p style="font-size: 12px; letter-spacing: 3px; color: #636161; max-width: 300px; margin:auto; line-height: 20px;">` + data.orgaddress + `</p>
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
        <table style="width: 100%; text-align: center; border-collapse: collapse;">
        <tbody style="font-size: 11px; text-transform: uppercase;">
            <tr>
            <td style="padding: 10px; position:relative; height:70px;" align="left" width="33%">
            <div style="max-width:100px; height:50px; position:absolute; top:10px; left: 10px;">
                <img style="width:100%; height:100%;" src="`+ data.orgurl + `">
            </div>
        </td>
                <td style="text-align:center;  padding: 0px;" align="center">
                    <h1 style=" font-size: 20px; padding: 10px;">` + data.orgname + `</h1>
                </td>
                <td style="text-align:right;  padding: 5px;" align="right">
                    <p style="margin:0; font-size:15px;">` + data.orgaddress + `</p>
                </td>
            </tr>
        </tbody>
    </table>
        <table style="width: 100%; border-collapse: collapse;page-break-after:always;">
        <tbody style="font-size: 11px; text-transform: uppercase;">`;
		row.map((elem, index) => {
			if (cols[index].toLowerCase().trim() === 'image') {
				var imageUrl = elem;
				if(imageUrl == '' || !imageUrl)
					imageUrl = 'https://ambeerenginefileupload.s3.amazonaws.com/no-thumb.png';
				rowHTML += `
            <tr>
            <td style="padding: 10px 5px;" colspan="3" align="center">
                <div style="max-width:100px; height:80px; margin:auto 10px; display: inline-block;">
                    <img style="width:100%; height:100%; border-radius: 5px;" src="` + imageUrl + `">
                </div>
            </td>
        </tr>`;
			}
			else if (cols[index].toLowerCase().trim() === 'images') {
				rowHTML += `<tr>
            <td style="padding:15px; width:200px; vertical-align:text-bottom;">
                <strong>Images</strong>
            </td>
            <td style="width:15px; padding:15px; vertical-align:text-bottom;">:</td>
            <td style="vertical-align:bottom; line-height:22px; text-align: justify; padding:15px;">`;
				var images = elem;
				for (var i = 0; i < images.length; i++) {
					rowHTML += `
                <div style="max-width:80px; height:80px; margin:0 10px 15px; display: inline-block;">
                    <img style="width:100%; height:100%; border-radius: 5px;" src="` + images[i] + `">
                </div>`;
				}
				rowHTML += `</td>
                        </t r>`;
			}
			else {
				rowHTML += `
            <tr>
            <td style="text-align:left;  padding: 10px;" align="left">
                            <h1 style="margin:0; font-size:16px;"> ` + cols[index] + `</h1>
                            <p style="font-size: 15px;margin-top:0px;">` + elem + `</p>
                        </td>
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
    <div style="position:fixed; bottom:20px; margin-left:10px; width:100%;">
    <p style="font-size: 12px; letter-spacing: 3px; color: #636161; line-height: 20px;">March 1, 2020</p>
</div>
</body>
</html>`;

	return totalHTML;
};

/*        */