const express = require('express');
const fs = require('fs');
let PDFExportOptions = JSON.parse(fs.readFileSync('./PDF-Export-Options.json', 'utf-8'))
const pdftemplate = require('./pdftemplate');
const newpdftemplate = require('./newpdftemplate');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    // console.log(JSON.stringify(PDFExportOptions, null, 2));
    res.send(pdftemplate.pdfhtmlBrochure(PDFExportOptions));
});

app.get('/catelog', (req, res) => {
    // console.log(JSON.stringify(PDFExportOptions, null, 2));
    res.send(newpdftemplate.pdfhtmlTable(PDFExportOptions));
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));