//const getChrome = require('./getChrome');
//const puppeteer = require('puppeteer-core');
const makePdf = require('./makepdf');
const puppeteer = require('puppeteer');

module.exports.pdfHandler = async (eventBody) => {
	try {
		const browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox']
		});
		var buff = await makePdf.makePdf(browser, eventBody.html, eventBody.options);
		await browser.close();
		return { file: buff, fileName: eventBody.filename };
	}
	catch (e) {
		console.log(e)
		throw e;
	}

};
