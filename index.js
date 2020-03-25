const express = require('express');
const fs = require('fs');
const pdftemplate = require('./pdftemplate');
const newpdftemplate = require('./newpdftemplate');
const pdfgen = require('./pdfHandler');
const app = express();
const port = 3000;

const PDFExportOptionsBrochure = JSON.parse(fs.readFileSync('./PDF-Export-Options-Brochure.json', 'utf-8'));
const PDFExportOptionsTable = JSON.parse(fs.readFileSync('./PDF-Export-Options-Table.json', 'utf-8'));

app.get('/', async (req, res) => {
    const options = {
        filename: "test-file"
    }
    const totalHTML = pdftemplate.pdfhtmlBrochure(PDFExportOptionsBrochure);
    const pdfResponse = await hitPDFService(totalHTML, options);
    res.send(totalHTML);
   
});

app.get('/table', (req, res) => {
    res.send(newpdftemplate.pdfhtmlTable(PDFExportOptionsTable));
});


async function hitPDFService(html, options) {
	var filename = 'downloads/'; //s3config.bucketname.uploads;
	const finalFileName = options.filename + '.pdf';
	filename += finalFileName;
	if (filename.split('.').length == 1)
		filename += '.pdf';
	var downloadPath = filename;

	const pdfConfig = {
		filename: downloadPath,
		options: {
			format: 'A4',
			landscape: (options.tableFormat !== undefined && options.tableFormat === true) ? true : false,
		},
		html: html,
	};
	let buffer = await pdfgen.pdfHandler(pdfConfig);
	buffer.fileName = finalFileName;
	return buffer;
}

app.listen(port, () => console.log(`Listening on port ${port}!`));