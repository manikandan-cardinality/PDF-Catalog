'use strict';
const AWS = require('aws-sdk');
const utils = require('./src/utility')
const logger = require('./src/db-logger')
const asyncutils = require('./src/async-utils')
const esClient = require('./elastic-search');
const pdftemplate = require('./templates/pdftemplate');
const newpdftemplate = require('./templates/newpdftemplate');
const pdfgen = require('./pdf-generator/pdfHandler');
const config = require('./config/config')['vesper'];
const archiver = require('archiver');
const streamBuffers = require('stream-buffers');
const exceljs = require('exceljs');
const shortid = require('shortid');
const path = require('path');
const fs = require('fs');
// For Local Dev
const result = require('dotenv').config();
if (result.error) {
	console.log("AWS Env");
}

if (process.env.STATION === 'local') {
	console.log("--> AWS SDK UPDATE")
	AWS.config.update({
		credentials: new AWS.Credentials(process.env.ACCESSKEY, process.env.SECRETKEY),
		region: process.env.REGION
	});
}

var _ = require('lodash');

const pg = require('knex')({
	client: 'pg',
	connection: {
		host: process.env.DB_HOST,
		port: process.env.DB_PORT,
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME
	},
	searchPath: ['knex', 'public'],
});
const s3 = new AWS.S3();
// Main Call - Passing JOB ID
doWork(process.argv[2]);

async function doWork(jobid) {
	await fileDownload(jobid)
}
async function fileDownload(jobid) {
	try {
		// Fetch Job Input
		let inputs_payload = await pg.select('input_payload').from('jobs').where('id', '=', jobid);
		// Input payload Validation.
		if (inputs_payload.length === 0) {
			logger.info(pg, '--> Nothing to Process', new Date(), 'batch-exceljson')
		}
		else {
			const params = inputs_payload[0].input_payload;

			if (!params.type || params.type == '' || ['mastercatalog', 'subcatalog'].indexOf(params.type) < 0)
				throw new Error('type fail');

			if (params.organizationid == '' || !params.organizationid)
				throw new Error('No organization id provided');

			if (((params.excel && params.excel === true) || (params.csv && params.csv === true)) && !params.exceltemplatelist)
				throw new Error('No Excel/CSV template provided');

			let searchQuery;
			console.log('\nparams..', JSON.stringify(params, null, 2), '\n');
			if ((params.productlist && params.productlist.length) || (params.vendorlist && params.vendorlist.length)) {
				console.log('\n * select * pdf process');
				searchQuery = {
					query: {
						bool: {
							must: [{
								term: { isdeleted: false },
							},
							{
								term: { active: true },
							}],
							filter: {
								terms: (params.type == 'mastercatalog') ? { 'id': params.productlist } : { 'vendorid': params.vendorlist },
							},
						},
					},
					size: 40000
				};
			} else {
				console.log('\n * select-all * pdf process');
				if (!params.searchQuery || params.searchQuery == '') {
					throw new Error('searchQuery is missing');
				}
				searchQuery = {
					size: 40000,
					query: JSON.parse(params.searchQuery),
					sort: [
						{
							updatedon: {
								order: 'desc'
							}
						}
					]
				}
			}
			const opts = {
				body: searchQuery,
				type: 'amberengine',
				indexName: 'products',
			};
			let isEmail = (params.to && params.to.length > 0) ? true : false;
			let to = (params.to) ? params.to : '';
			let xlsx = (params.excel) ? params.excel : false;
			let csv = (params.csv) ? params.csv : false;
			let pdf = (params.brochuretemplateid) ? true : false;

			console.log('\nget products ES start', new Date());
			let results = await asyncutils.esSearchServiceAsync(esClient, opts);
			console.log('\nget products ES end', results.hits.total, new Date());

			if (results.hits.total <= 0) {
				throw new Error('No products are available to export.');
			}
			else {
				let compressed = 1;
				let non_compressed = 1;
				// Process Each product
				results.hits.hits.map((productdata) => {
					// Build Image Object
					productdata._source.images.map((item) => {
						if (item.compressed === true) {
							let filename = "";
							filename = item.s3path.split("/images/");
							if (filename[1] !== undefined && filename[1] != null) {
								filename[1] = "compressed/" + filename[1];
								item.url = filename.join("/images/");
								compressed = compressed + 1;
							} else {
								filename = item.s3path.split("/");
								filename[3] = "compressed/" + filename[3];
								item.url = filename.join("/");
								compressed = compressed + 1;
							}
						}
						else {
							non_compressed = non_compressed + 1;
						}
						item.isChecked = false;
						return item;
					});
					return productdata;
				});
				
				console.log('\ncompressed', compressed);
				console.log('\nnon_compressed', non_compressed);
				let brochure = !!params.brochure;
				let exportOptions = {
					xlsx,
					csv,
					results,
					isEmail,
					to,
					pdf,
					templateid: (params.brochuretemplateid) ? params.brochuretemplateid : 4,
					brochure,
					tableFormat: (params.tableFormat) ? params.tableFormat : false,
					filename: (params.filename) ? params.filename : '',
					xlsxtemplatelist: params.exceltemplatelist,
					orgid: params.organizationid,
					segregate: (params.type == 'mastercatalog' && params.productlist && params.productlist.length > 0) ? false : true
				};
				await exportExcelCSVPDF(exportOptions, jobid);
			}

		}
	} catch (err) {
		console.log(err);
		logger.error(pg, 'ERROR', err, 'excel-duplicate');
		await utils.updateJobById(pg, jobid, {
			status: "FAILED",
			errormsg: err
		});
		pg.destroy([]);
	}
	process.exit(0);
}

async function exportExcelCSVPDF(options, jobid) {
	try {
		var fileList = [];
		if (options.xlsx || options.csv) {
			var excelOptions = {
				xlsx: options.xlsx,
				csv: options.csv,
				results: options.results,
				templatelist: options.xlsxtemplatelist,
				segregate: options.segregate
			};
			// console.log(excelOptions)
			const excelOptionsResult = await sendExcelAndCSV(excelOptions);
			const tes = [...excelOptionsResult];
			fileList.push(...tes);
			// console.log(fileList)
		}
		if (options.pdf) {
			if (options.brochure === true && options.tableFormat === true) {
				var tableOptions = {
					results: options.results,
					filename: options.filename,
					orgid: options.orgid,
					tableFormat: true,
					templateid: options.templateid,
				};
				var brochureOptions = JSON.parse(JSON.stringify(tableOptions));
				tableOptions.userfilename = tableOptions.filename;
				tableOptions.filename = tableOptions.filename + '-Table';
				tableOptions.getCurrentDate = getCurrentDate();
				brochureOptions.tableFormat = false;
				brochureOptions.userfilename = brochureOptions.filename;
				brochureOptions.filename = brochureOptions.filename + '-Catalog';
				brochureOptions.getCurrentDate = tableOptions.getCurrentDate;
				const zipPDFResponse = await zipPDF(tableOptions, brochureOptions)
				fileList.push(...zipPDFResponse);
			}
			else if (options.tableFormat || options.brochure) {
				var pdfOptions = {
					results: options.results,
					filename: options.filename,
					orgid: options.orgid,
					tableFormat: options.tableFormat,
					templateid: options.templateid,
				};
				const pdfOptionsResponse = await sendPDF(pdfOptions);
				fileList.push(pdfOptionsResponse);
			}
		}
		console.log('zipFileBuffer start', new Date(), fileList);
		const zipFile = await asyncutils.zipFile(archiver, streamBuffers, fileList);
		console.log('zipFileBuffer end', new Date());


		console.log('zip upload to s3 start', new Date());
		const dt = new Date();
		const uploadResponse = await s3.upload({
			Bucket: process.env.DOWNLOADBUCKETNAME + '/' + shortid.generate(),
			Key: `${options.filename}_${utils.getFormattedTime()}.zip`,
			Body: zipFile,
			ACL: 'public-read'
		}).promise();
		console.log('zip upload to s3 end', new Date());

		console.log('s3 zip uploadResponse', JSON.stringify(uploadResponse, null, 2));
		// GET FILE SIZE
		const params = {
			Bucket: process.env.DOWNLOADBUCKETNAME,
			Key: uploadResponse.Key
		};
		const metadata = await s3.headObject(params).promise();
		const size = formatBytes(metadata.ContentLength, 2);

		console.log('zip file size', size);

		if (options.isEmail === true) {
			var emailOptions = {
				to: options.to,
				subject: 'From Amber Engine',
				body: 'Here are your files: \n '
			};
			emailOptions.url = uploadResponse.Location;
			emailOptions.body += uploadResponse.Location + '\n';
			// emailOptions.finalResults = finalResults;
			emailOptions.csv = options.csv;
			emailOptions.xlsx = options.xlsx;
			emailOptions.filename = options.filename;
			console.log('emailOptions', JSON.stringify(emailOptions, null, 2));
			await sendEmail(emailOptions)

			await utils.updateJobById(pg, jobid, {
				status: "SUCCESS",
				output_payload: {
					size: size,
					Key: uploadResponse.Key,
					Location: uploadResponse.Location
				}
			});
		}
		else {
			await utils.updateJobById(pg, jobid, {
				status: "SUCCESS",
				output_payload: {
					size: size,
					Key: uploadResponse.Key,
					Location: uploadResponse.Location
				}
			});
			console.log("SUCCESS", {
				size: size,
				Key: uploadResponse.Key,
				Location: uploadResponse.Location
			});
		}

	} catch (error) {
		console.log(error);
		logger.failed(pg, 'exportExcelCSVPDF', error, options)
		await utils.updateJobById(pg, jobid, {
			status: "FAILED",
			output_payload: { success: false, message: error }
		});
	}
}

function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getCurrentDate() {
	const monthNames = ["January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"];
	let dateObj = new Date();
	let month = monthNames[dateObj.getMonth()];
	let day = String(dateObj.getDate()).padStart(2, '0');
	let year = dateObj.getFullYear();
	return month + '\n' + day + ', ' + year;
}

async function sendExcelAndCSV(options) {
	var results = options.results;
	var templatelist = options.templatelist;
	var xlsx = options.xlsx;
	var csv = options.csv;
	var getCSVOptions = {
		results,
		includeCategory: false,
		segregate: options.segregate,
	};
	const templateGetSql = 'SELECT data, title FROM template WHERE id IN ' + buildSqlList(templatelist, true);
	const sqlResults = (await pg.raw(templateGetSql)).rows;
	const templateResults = sqlResults.map(async (template) => {
		const templateOpts = {};
		templateOpts.getCSVOptions = JSON.parse(JSON.stringify(getCSVOptions));
		templateOpts.template = template;
		templateOpts.xlsx = xlsx;
		templateOpts.csv = csv;
		const resultData = await sendExcelAndCSVHelper(templateOpts);
		return resultData;
	});
	const _templateResults = await Promise.all(templateResults)
	return spread(..._templateResults);
}

function spread(args) {
	return args;
}

async function sendPDF(options) {
	const results = await generatePDF(options);
	return results;
}

async function zipPDF(tableOptions, brochureOptions) {
	const tableOptionsResults = await generatePDF(tableOptions);
	const brochureOptionsResults = await generatePDF(brochureOptions);
	return [tableOptionsResults, brochureOptionsResults];
}

async function generatePDF(options) {
    const pdfData = await getPDFRows(options);
    var excelData = pdfData.excelData;
    if (excelData.columns.length > 0) {
        var totalHTML, htmlOptions;
        htmlOptions = {
            orgurl: pdfData.orgurl,
			orgname: pdfData.orgname,
			userfilename: options.userfilename,
            orgaddress: pdfData.orgaddress,
            rows: excelData.data,
            cols: excelData.columns,
        };
        if (options.tableFormat === true) {
			// console.log('\n tableOptions', JSON.stringify(htmlOptions, null, 2), '\n');
			fs.writeFile('tableOptions.json', JSON.stringify(htmlOptions, null, 2), function (err) {
				if (err) throw err;
				console.log('tableOptions Saved!');
			});
            totalHTML = newpdftemplate.pdfhtmlTable(htmlOptions);
        }
        else {
			// console.log('\n pdfhtmlBrochure', JSON.stringify(htmlOptions, null, 2), '\n');
			fs.writeFile('brochureOptions.json', JSON.stringify(htmlOptions, null, 2), function (err) {
				if (err) throw err;
				console.log('brochureOptions Saved!');
			});
            totalHTML = pdftemplate.pdfhtmlBrochure(htmlOptions);
        }
        const pdfResponse = await hitPDFService(totalHTML, options);
        return pdfResponse;
    }

}

async function sendExcelAndCSVHelper(options) {
	var getCSVOptions = options.getCSVOptions;
	var xlsxWorkbook = new exceljs.Workbook();
	var csvWorkbook = new exceljs.Workbook();
	var template = options.template;
	var xlsx = options.xlsx;
	var csv = options.csv;
	var templateMappings = template.data.data;
	getCSVOptions.filterAttributes = _.map(templateMappings, 'output');
	getCSVOptions.filterAttributes = _.flatten(getCSVOptions.filterAttributes);

	//converting image to image1, image2, image3..etc
	let imageIndex = 0;
	let columns = [];
	getCSVOptions.filterAttributes.map((item) => {
		if (item && item.toLowerCase() === 'image') {
			let index = imageIndex + 1;
			columns.push('Image' + index);
			imageIndex++;
		} else {
			columns.push(item);
		}
	});

	getCSVOptions.filterAttributes = _.zipObject(getCSVOptions.filterAttributes.map((item) => item.toLowerCase().trim()), _.map(getCSVOptions.filterAttributes, () => true));
	getCSVOptions.downloadType = 'xlsx-or-csv';
	var excelData = getCSVRows(getCSVOptions);
	var colsWithHeaders = [];
	if (getCSVOptions.segregate === true) {
		Object.keys(excelData).map((subcat, index) => {
			var templateExcelData = templateMap(excelData[subcat], templateMappings);
			if (index === 0) {
				templateExcelData.columns.map((colName) => {
					colsWithHeaders.push({ header: colName, key: colName, width: 20 });
				});
			}
			if (xlsx === true) {
				if (xlsxWorkbook.worksheets.length == 0)
					xlsxWorkbook.addWorksheet('Sheet 1');
				xlsxWorkbook.worksheets[0].columns = colsWithHeaders;
				// res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
				xlsxWorkbook.worksheets[0].addRows(templateExcelData.data);
			}
			if (csv === true) {
				if (csvWorkbook.worksheets.length == 0)
					csvWorkbook.addWorksheet('Sheet 1');
				csvWorkbook.worksheets[0].columns = colsWithHeaders;
				csvWorkbook.worksheets[0].addRows(templateExcelData.data);
			}
		});
	}
	else {
		var templateExcelData = templateMap(excelData, templateMappings);
		templateExcelData.columns.map((colName) => {
			colsWithHeaders.push({ header: colName, key: colName, width: 20 });
		});
		if (xlsx === true) {
			var xlsxworksheet = xlsxWorkbook.addWorksheet('Sheet 1');
			xlsxworksheet.columns = colsWithHeaders;
			xlsxworksheet.addRows(templateExcelData.data);
		}
		if (csv === true) {
			var csvworksheet = csvWorkbook.addWorksheet('Sheet 1');
			csvworksheet.columns = colsWithHeaders;
			csvworksheet.addRows(templateExcelData.data);
		}
	}

	var results = [];
	if (xlsx === true) {
		const result = await excelOrCsvExporter(xlsxWorkbook, 'xlsx', template.title);
		results.push(result);
	}
	if (csv === true) {
		const result = await excelOrCsvExporter(xlsxWorkbook, 'csv', template.title);
		results.push(result);
	}
	// console.log(result);
	return results;
}

async function getPDFRows(options) {
    let templateQuery = '';
    if (options.templateid.id != undefined && options.templateid.id != null) {
        templateQuery = `SELECT t.attributes,o.name,o.orgimageurl,o.addressinfor FROM product_brochure t inner join organization o on t.organizationid=o.id WHERE t.id='${options.templateid.id}' and t.organizationid='${options.orgid}'`;
    } else {
        templateQuery = `SELECT t.attributes,o.name,o.orgimageurl,o.addressinfor FROM product_brochure t inner join organization o on t.organizationid=o.id WHERE t.id='${options.templateid}' and t.organizationid='${options.orgid}'`;
    }
    var pgResults = (await pg.raw(templateQuery)).rows
    var attributesEnabled = {};
    var orgurl = '';
    var orgname = '';
    var orgaddress = '';
    if (pgResults.length == 0 || pgResults[0].attributes === undefined || pgResults[0].attributes.length == 0) {
        throw new Error('No attributes to print PDF');
    }

    pgResults[0].attributes = {
        attrs: pgResults[0].attributes,
        data: {}
    };
    pgResults[0].attributes.data = _.orderBy(pgResults[0].attributes.attrs, ['rank'], ['asc']);
    pgResults[0].attributes.data = _.map(pgResults[0].attributes.data, 'content');
    pgResults[0].attributes.data = pgResults[0].attributes.data.map((x) => { return x.toLowerCase().trim(); });
    pgResults[0].attributes.data.unshift('image');
    attributesEnabled = _.zipObject(pgResults[0].attributes.data, _.map(pgResults[0].attributes.data, () => (true)));
    if (pgResults[0]) {
        orgurl = (pgResults[0].orgimageurl) ? pgResults[0].orgimageurl : '';
        orgname = (pgResults[0].name) ? pgResults[0].name : '';
        let fullAddress = '';
        if(pgResults[0].addressinfor) {
            try {
                fullAddress = JSON.parse(pgResults[0].addressinfor);
                fullAddress = fullAddress.address + '<br />' +
                    fullAddress.address2 + '<br/>' + fullAddress.city + ', ' +
                    fullAddress.state + ' ' + fullAddress.zipcode;
            } catch (error) {
            }
        }
        orgaddress = fullAddress;
    }
    var excelData = getCSVRows({
        downloadType: 'pdf',
        results: options.results,
        includeCategory: false,
        filterAttributes: attributesEnabled,
        tableFormat: options.tableFormat
    });
    var result = {
        excelData, orgurl, orgname, orgaddress
    };
    return result;

}

async function hitPDFService(html, options) {
	var filename = 'downloads/'; //s3config.bucketname.uploads;
	const finalFileName = options.filename + '.pdf';
	filename += finalFileName;
	if (filename.split('.').length == 1)
		filename += '.pdf';
	var downloadPath = process.env.DIRECTORYPATH + filename;

	const pdfConfig = {
		filename: downloadPath,
		options: {
			format: 'A4',
			landscape: (options.tableFormat !== undefined && options.tableFormat === true) ? true : false,
			displayHeaderFooter: (options.tableFormat !== undefined && options.tableFormat === true) ? false : true,
			footerTemplate: `
			<div  class="pdfheader">
				<div style="margin-left:17px !important; font-size: 12px !important; color: #636161 !important; float:left !important;">` + options.getCurrentDate + `</div>
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

async function sendEmail(options) {
	var fs = require('fs');
	let htmlContent = fs.readFileSync(path.join(__dirname, '/templates/download-file-link.html')).toString('utf8');
	let textContent = fs.readFileSync(path.join(__dirname, '/templates/download-file-link.txt')).toString('utf8');
	htmlContent = htmlContent.replace('{{DOWNLOADLINK}}', options.url);
	textContent = textContent.replace('{{DOWNLOADLINK}}', options.url);

	let params = {
		Destination: {
			ToAddresses: options.to
		},
		Message: {
			Body: {
				Html: {
					Charset: "UTF-8",
					Data: htmlContent
				},
				Text: {
					Charset: "UTF-8",
					Data: textContent
				}
			},
			Subject: {
				Charset: 'UTF-8',
				Data: options.subject
			}
		},
		Source: config.EmailSource,
	};
	console.log(params)
	// Create the promise and SES service object
	console.log(params)
	// Create the promise and SES service object
	console.log('sendEmail start', new Date());
	let sendPromise = await (new AWS.SES().sendEmail(params).promise());
	console.log('sendEmail end', new Date());
	console.log('sendPromise AWS SES Response', JSON.stringify(sendPromise, null, 2));
	// Handle promise's fulfilled/rejected states
	return sendPromise;
}

function buildSqlList(list, isString = false) {
	var sql = '(';
	list.map((val, index) => {
		if (isString)
			sql += '\'';
		sql += val.toString();
		if (isString)
			sql += '\'';
		if (index != list.length - 1) {
			sql += ',';
		}
	});
	sql += ')';
	return sql;
}

function getCSVRows(options) { // results is the result of elasticsearch search. it has hits as a key.
	var results = options.results;
	var includeCategory = (options.includeCategory) ? options.includeCategory : false;
	var filterAttributes = (options.filterAttributes) ? options.filterAttributes : undefined;
	var tableFormat = (options.tableFormat) ? options.tableFormat : false;
	var segregate = (options.segregate) ? options.segregate : false;
	var data = [];
	var columns = {};
	var isAttributesFiltered = (filterAttributes !== undefined);
	if (isAttributesFiltered) {
		columns = filterAttributes;
		setAllAsEmptyString(columns, '');
	}
	var segregatedRows = {};
	results.hits.hits.map((res) => {
		res['_source'].attributes.map((att) => {
			att.fields.map((field) => {
				// console.log(field)
				if (field.systemName !== undefined) {
					if (field.value && field.value !== '') {
						var fieldName = field.systemName.trim().toLowerCase();
						// if (isNaN(field.value)) {
						// 	field.value = field.value
						// } else {
						// 	field.value = rounddecimalvalues(field.value)
						// }
					}
					if (isAttributesFiltered) {
						// console.log('Fieldname: ', fieldName);
						if (columns[fieldName] !== undefined) {
							columns[fieldName] = field.value;
						}
						// console.log('Columnsfieldname: ', columns[fieldName]);
					} else {
						columns[fieldName] = field.value;
					}
				}
			});
		});
		var rowImages = [];
		if (options.downloadType && options.downloadType === 'pdf') {
			if (Array.isArray(res['_source'].images)) {
				res['_source'].images.map((img, index) => {
					if (img.landing !== undefined && img.landing == 'true')
						columns['image'] = img.pdf;
					else if (index == 0 && img.url)
						columns['image'] = img.url;
					if (index > 0 && img.url)
						rowImages.push(img.url);
				});
			}
		}
		if (tableFormat == false) {
			if (Object.keys(rowImages).includes("images")) {
				columns['images'] = rowImages;
			}
		}
		//mapping image1, image2, image3 values..
		if (options.downloadType && options.downloadType === 'xlsx-or-csv') {
			res['_source'].images.map((img, index) => {
				let num = index + 1;
				let imageKey = 'image' + num;
				columns[imageKey] = img.url;
			});
		}

		if (includeCategory == true) {
			var categoryJson = [];
			res['_source'].category.map((cat) => {
				categoryJson.push({ 'inputName': cat.name, 'inputFields': cat.subcategories });
			});
			columns['category'] = JSON.stringify(categoryJson);
		}
		if (segregate === true) {
			if (segregatedRows[res['_source'].vendorid]) {
				segregatedRows[res['_source'].vendorid]['data'].push(Object.values(columns));
				segregatedRows[res['_source'].vendorid]['columns'] = Object.keys(columns);
				setAllAsEmptyString(columns, '');
			}
			else {
				segregatedRows[res['_source'].vendorid] = {
					data: [Object.values(columns)],
					columns: Object.keys(columns)
				};
			}
		}
		else {	// console.log(columns);
			data.push(Object.values(columns));
			setAllAsEmptyString(columns, '');
		}
	});
	if (segregate === true) {
		return segregatedRows;
	}
	else return { data: data, columns: Object.keys(columns) };
}

const setAllAsEmptyString = (obj, val) => Object.keys(obj).forEach(k => obj[k] = val);

function templateMap(excelData, template) {
	var finalData = {
		columns: [],
		data: []
	};
	if (template.length == 0)
		return excelData;
	if (excelData.data.length == 0) {
		finalData.columns = _.map(template, 'input');
		finalData.data = [];
		return finalData;
	}
	//var transposedData = _.zipObject(excelData.columns, transposedData);
	var input = mapAndReplace(template, 'input', isUndefinedOrNull, '');
	// converting image to image1, image2, image3..etc
	let imageIndex = 0;
	template.map((item) => {
		if (item && item.output && item.output.length > 0 && item.output[0].toLowerCase() === 'image') {
			let index = imageIndex + 1;
			imageIndex++;
			item.output = ['Image' + index];
		}
		return item;
	});
	var output = arrayOfArrayToLower(mapAndReplace(template, 'output', isUndefinedOrNull, ''));
	var separator = mapAndReplace(template, 'separator', isUndefinedOrNull, '');
	var addSpace = mapAndReplace(template, 'addspace', isUndefinedOrNull, false);
	var unit = mapAndReplace(template, 'unitmarker', (x) => { return isUndefinedOrNull(x) || x == 'None' }, '');
	var maxlength = mapAndReplace(template, 'maxlength', isUndefinedOrNull, Infinity);
	var unmapped = mapAndReplace(template, 'fields._unmapped', isUndefinedOrNull, '');
	var changes = mapAndReplace(template, 'fields._changes', isUndefinedOrNull, [{}]);
	var blank = mapAndReplace(template, 'fields._blank', isUndefinedOrNull, '');
	changes = changes.map((change) => {
		if (change.length > 0) {
			return _.zipObject(_.map(change, 'input'), _.map(change, 'output'));
		}
	});
	input.map((inp, index) => {
		finalData.columns.push(inp);
		var thisCol = changeCell({
			excelData,
			output: output[index],
			separator: separator[index],
			addSpace: addSpace[index],
			unit: unit[index],
			maxlength: maxlength[index],
			unmapped: unmapped[index],
			changes: changes[index],
			blank: blank[index]
		});
		finalData.data.push(thisCol);
	});
	finalData.data = _.zip.apply(_, finalData.data);
	return finalData;
}

function mapAndReplace(arr, key, condition, replacement) {
	var result = [];
	result = _.map(arr, key);
	result = _.map(result, (x) => {
		if (condition(x))
			return replacement;
		if (key === 'output' && typeof x === 'string')
			x = [x];
		return x;
	});
	return result;
}

function changeCell(options) {
	var finalData = [];
	var data = options.excelData.data;
	var columns = options.excelData.columns;
	var output = options.output;
	var separator = options.separator;
	var addSpace = options.addSpace;
	var unit = options.unit;
	var maxlength = options.maxlength;
	var unmapped = options.unmapped;
	var changes = options.changes;
	var blank = options.blank;
	if (data.length <= 0)
		finalData = [blank];
	else if (output.length <= 0)
		finalData = Array(data.length).fill(blank);
	else {
		var colIndexes = output.map((col) => {
			return columns.indexOf(col);
		});
		data.map((row) => {
			var currentCell = '';
			colIndexes.map((col, index) => {
				if (typeof row[col] == 'number' || typeof row[col] == 'bigint' || typeof row[col] == 'symbol')
					row[col] = row[col].toString();
				if (col < 0)
					currentCell += unmapped;
				if ((typeof row[col] == 'string' && row[col].trim() == '') || (typeof row[col] != 'string'))
					currentCell += unmapped;
				else
					currentCell += row[col];
				if (index != colIndexes.length - 1) {
					if (!(typeof row[col] == 'string' && row[col].trim() == '' && unmapped == ''))
						currentCell += separator;
					if (addSpace)
						currentCell += ' ';
				}
				else
					currentCell += unit;
			});
			Object.keys(changes).map((change) => {
				currentCell = currentCell.replace(change, changes[change]);
			});
			currentCell = currentCell.substr(0, maxlength);
			if (currentCell == '' || (currentCell.trim()) == '')
				currentCell = blank;
			finalData.push(currentCell);
		});
	}
	return finalData;
}

function arrayOfArrayToLower(arr) {
	var result = arr.map((x) => {
		return arrayToLower(x);
	});
	return result;
}

function arrayToLower(arr) {
	return _.map(arr, (x) => {
		return x.toLowerCase().trim();
	});
}

function isUndefinedOrNull(x) {
	if (x === undefined || x === null || x === '')
		return true;
	return false;
}

async function excelOrCsvExporter(workbook, type, templatename) {
	var fileSignature = templatename + '.' + type;
	var filename = path.resolve(__dirname, fileSignature);
	await workbook[type].writeFile(filename);
	var fileBuffer = fs.readFileSync(filename);
	try {
		fs.unlinkSync(filename)
		//file removed
	} catch (err) {
		console.error(err)
	}
	return { file: fileBuffer, fileName: fileSignature };
}