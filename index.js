const express = require('express');
const fs = require('fs');
const pdftemplate = require('./pdftemplate');
const newpdftemplate = require('./newpdftemplate');
const pdfgen = require('./pdfHandler');
const app = express();
const port = 3000;

const PDFExportOptionsBrochure = JSON.parse(fs.readFileSync('./PDF-Export-Options-Brochure.json', 'utf-8'));
const PDFExportOptionsTable = JSON.parse(fs.readFileSync('./PDF-Export-Options-Table.json', 'utf-8'));

const isPDF = true; // isPDF false means it should be Web page (HTML) else true means PDF

app.get('/', async (req, res) => {
	const options = {
		filename: "test-file",
		tableFormat: false
	}
	const totalHTML = pdftemplate.pdfhtmlBrochure(PDFExportOptionsBrochure);
	if (isPDF) {
		const pdfResponse = await hitPDFService(totalHTML, options);
		res.setHeader('Content-Type', 'application/pdf');
		res.send(pdfResponse.file);
		return;
	} else {
		res.send(totalHTML);
	}
});

app.get('/table', async (req, res) => {
	const options = {
		filename: "test-file",
		tableFormat: true
	}
	const totalHTML = newpdftemplate.pdfhtmlTable(PDFExportOptionsTable);
	if (isPDF) {
		const pdfResponse = await hitPDFService(totalHTML, options);
		res.setHeader('Content-Type', 'application/pdf');
		res.send(pdfResponse.file);
	} else {
		res.send(totalHTML);
	}
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
			displayHeaderFooter: (options.tableFormat !== undefined && options.tableFormat === true) ? false : true,
			footerTemplate: `
			<div  class="pdfheader">
				<div style="margin-left:17px !important; font-size: 12px !important; color: #636161 !important; float:left !important;">March 26, 2020</div>
				<div style="margin-left:470px !important; font-size: 12px !important; color: #636161 !important; float:right !important;" class="pageNumber"></div>
    		</div>`,
			margin: {top: 20, bottom: 40}
		},
		html: html,
	};
	let buffer = await pdfgen.pdfHandler(pdfConfig);
	buffer.fileName = finalFileName;
	return buffer;
}

app.listen(port, () => console.log(`Listening on port ${port}!`));