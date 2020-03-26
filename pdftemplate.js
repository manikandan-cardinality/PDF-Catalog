function getBrochureRows(data) {
    var rows = data.rows;
    var cols = data.cols;
    var tableHTML = '';
    rows.map((row) => {
        var rowHTML = `<br /><div style="page-break-after:always;"><div style="margin: 5mm 5mm 15mm 5mm; display: block; position: relative;"> 
        <table style="width: 100%; text-align: center; border-collapse: collapse;">
        <tbody style="font-size: 14px; text-transform: capitalize;">
            <tr>
            <td style="padding: 10px; position:relative; height:70px;" align="left" width="33%">
            <div style="max-width:100px; height:85px; position:absolute; top:10px; left: 10px;">
                <img style="width:100%; height:85px;" src="`+ data.orgurl + `">
            </div>
        </td>
                <td style="text-align:center;  padding: 0px;" align="center">
                    <h1 style=" font-size: 20px; padding: 10px;">` + data.userfilename + `</h1>
                </td>
                <td style="text-align:right;  padding: 5px;" align="right">
                    <p style="margin:0; font-size:15px;line-height:24px;">` + data.orgaddress + `</p>
                </td>
            </tr>
        </tbody>
    </table>

    <table  style="margin: 5mm 5mm 15mm 5mm; display: block; position: relative;page-break-after:always;">
        <tbody style="font-size: 14px; text-transform: capitalize;">`;
        row.map((elem, index) => {
            if (cols[index].toLowerCase().trim() === 'image') {
                var imageUrl = elem;
                if (imageUrl == '' || !imageUrl)
                    imageUrl = 'https://ambeerenginefileupload.s3.amazonaws.com/no-thumb.png';
                rowHTML += `
            <tr>
                <td style="padding: 10px 5px;" colspan="3" align="center">
                    <div style="max-width:100px; height:80px; margin:auto 10px; display: inline-block;">
                        <img style="width:100%; height:100%; border-radius: 5px;" src="` + imageUrl + `">
                    </div>
                </td>
            </tr>
            `;
            }
            else if (cols[index].toLowerCase().trim() === 'images') {
                rowHTML += `<tr>
            <td style="padding:15px; width:200px; vertical-align:text-bottom;">
                <strong>Images</strong>
            </td>
            <td style="vertical-align:bottom; line-height:22px; text-align: justify; padding:15px;">`;
                var images = elem;
                for (var i = 0; i < images.length; i++) {
                    rowHTML += `
                <div style="max-width:80px; height:80px; margin:0 10px 15px; display: inline-block;">
                    <img style="width:100%; height:100%; border-radius: 5px;" src="` + images[i] + `">
                </div>`;
                }
                rowHTM`</td>
                        </t r>`;
            }
            else {
                rowHTML += `
            <tr>
                <td style="text-align:left;  padding: 15px;" align="left">
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
    </div>
    `;
        tableHTML += rowHTML;
    });
    return tableHTML;
}
module.exports.pdfhtmlBrochure = function (data) {
    var index = 0;
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
</body>
</html>`;
    return totalHTML;
};