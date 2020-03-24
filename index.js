const express = require('express');
const fs = require('fs');
const pdftemplate = require('./pdftemplate');
const newpdftemplate = require('./newpdftemplate');
const app = express();
const port = 3000;

const PDFExportOptionsBrochure = JSON.parse(fs.readFileSync('./PDF-Export-Options-Brochure.json', 'utf-8'));
const PDFExportOptionsTable = JSON.parse(fs.readFileSync('./PDF-Export-Options-Table.json', 'utf-8'));

app.get('/', (req, res) => {
    res.send(pdftemplate.pdfhtmlBrochure(PDFExportOptionsBrochure));
});

app.get('/table', (req, res) => {
    res.send(newpdftemplate.pdfhtmlTable(PDFExportOptionsTable));
});

app.listen(port, () => console.log(`Listening on port ${port}!`));