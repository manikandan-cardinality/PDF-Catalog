function getRow(row) {
    var imageUrl = row[0];
    if (imageUrl == '' || imageUrl === undefined)
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
            rowHTML += '<td style="padding: 5px; border:solid 1px #222;padding: 10px;  overflow: hidden;text-overflow: ellipsis;white-space: nowrap;max-width:100px;">' + val + '</td>';
    });
    rowHTML += '</tr>';
    return rowHTML;
}

function getCol(cols) {
    var colHTML = `<tbody style="font-size: 11px; text-transform: uppercase;">
    <tr style="background-color: #bfbfbf;">`;
    cols.map((col) => {
        colHTML += `
        <td style="padding: 10px; border:solid 1px #222;padding: 10px;  overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;max-width:120px;"> 
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
    for (var i = 0; i < data.rows.length; i += rowsPerPage) {
        totalHTML += `    <div style="margin: 5mm 5mm 15mm 5mm; display: block; position: relative;page-break-after:always;">
        <table style="width: 100%; text-align: center; border-collapse: collapse; overflow-x:auto;">
            <tbody style="font-size: 11px; text-transform: uppercase;">
                <tr style="border-width: 1px 1px 0 1px; border-style: solid; border-color: #222;">
                    <td style="text-align:left;  padding: 10px;">
                        <h1 style="margin:0; font-size:20px;">` + data.orgname + `</h1>
                        <p>` + data.orgaddress + `</p>
                    </td>
                    <td style="padding: 10px; position:relative; height:70px;" align="right">
                    <div style="max-width:100px; height:85px; top:10px; right: 10px;">
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
        var tempData = data.rows.slice(i, i + rowsPerPage);
        tempData.map((row) => {
            totalHTML += getRow(row);
        });
        totalHTML += `
            </tbody>
        </table>
        
    </div>`;
    }
    totalHTML += `
    </body>
</html>
`;
    return totalHTML;
};
