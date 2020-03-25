exports.makePdf = async (browser, html,options)=> {
	const page = await browser.newPage();
	await page.setViewport({
		width:1920,
		height:1080,
		isMobile : false,
	});
	await page.setContent(html, { waitUntil: 'networkidle2', timeout: 0 });
	const buff = await page.pdf(options);
	return buff;
};
