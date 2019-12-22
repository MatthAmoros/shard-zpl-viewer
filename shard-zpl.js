/*!
*   @author : Matthieu AMOROS
*   @description : ZPL interpreter
*/
//Declare context and save a blank state
/*
var g_replacementValues = [];
g_replacementValues["<ID>"] = "000001";
*/
var c = document.getElementById('mainCanvas');
var ctx = c.getContext("2d");

//Clear
ctx.clearRect(0, 0, c.width, c.height);
ctx.save();

/**
* [getPositionFromCommand: Extract field position (x,y) from ZPL command]
* @param  {[string]} command [ZPL code]
* @return  {[string]} position [as x,y]
*/
function getPositionFromCommand(command) {
	const regex = /((\^FT)|(\^FO))(.[0-9,]*)\^/;
	let results = regex.exec(command);
	//Second result is position
	if(results != null && results.length >= 2)
	return results[results.length - 1].split(',');
	else
	//Not found
	return "NA,NA".split(',');
}

/**
* [getTextValueFromCommand: Extract text field value from ZPL command]
* @param  {[string]} command [ZPL code]
* @return  {[string]} text [text field value]
*/
function getTextValueFromCommand(command) {
	const regex = /\^FD(.*)\^FS/u;
	let results = regex.exec(command);
	//Second result is position
	if(results != null)
	return results[1];
	else
	//Not found
	return "";
}

/**
* [displayLabel: Display label represented by ZPL code on target canvas]
* @param  {[string]} canvasId [canvas element id]
* @param  {[string]} label [ZPL code]
* @param  {[string]} replacementValues [Dictionnary of ZPL token and value]
*/
function displayLabel(canvasId, label, replacementValues, scale) {
	//Clear
	ctx.clearRect(0, 0, c.width, c.height);
	clearLayers();

	let currentPosition = "0,0".split(',');
	let currentLayer = 1;

	//Get each command
	var commandLines = label.match(/\^(.*?)FS/g);
	try {
		if (commandLines.length > 0) {
			commandLines.forEach(function (commandLine) {
				let formatedText = commandLine;
				let properties = formatedText.split('^');
				let rads = 0;
				let position = "0,0".split(',');

				//Get position
				let newPosition = getPositionFromCommand(commandLine);
				if(isNaN(newPosition[0]) || isNaN(newPosition[1]))
				{
					console.log("No position found, keep current one.");
					position = currentPosition;
				}
				else
				{
					currentPosition = newPosition;
					position = currentPosition;
				}

				let x, y = 0;
				x = parseInt(position[0]);
				y = parseInt(position[1]);

				//Get text value
				let textValue = getTextValueFromCommand(commandLine);
				textValue = checkForReplacement(textValue, 	replacementValues);

				//FX = Comment, continue
				if (formatedText.indexOf('^FX') >= 0 || isNaN(position[0]) || isNaN(position[1])) {
					console.log("Not displayed : " + formatedText.replace('^FX', '')); return;
				}

				if (containsBarCodeDefinition(commandLine)) {
					//Rotate
					rads = getRotationFromCode(properties[3]);

					let barCodeType = getBarcodeTypeFromCode(commandLine);
					let layerId = createNewLayer(currentLayer);

					if (rads > 0) {
						//Translate to object position to apply rotation
						var layer = document.getElementById(layerId);
						var ctx_layer = layer.getContext("2d");
						ctx_layer.translate(x , y);
						ctx_layer.rotate(rads);
						//Already on point, relative coordinate are 0
						x = 0;
						y = 0;
					}

					var options = buildBarCodeOptions(commandLine, barCodeType, x, y, false, textValue);

					//https://barcode-coder.com/en/barcode-jquery-plugin-201.html
					$("#" + layerId).barcode(
						textValue,
						barCodeType,
						options
					);

					console.log("[" + x + "," + y + ":" + rads + "|BARCODE " + getBarcodeTypeFromCode(commandLine) +"] " + textValue);
				}
				else if (properties[2].startsWith("GB")) {
					//Box
					drawBox(position, properties[2].replace('GB', ''), ctx);
				}
				else {
					//Text & font
					ctx.font = getFontFromCode(properties[2]);

					//Rotate
					rads = getRotationFromCode(properties[2]);

					if (rads > 0) {
						//Translate to object position to apply rotation
						ctx.translate(x , y);
						ctx.rotate(rads);
						//Already on point, relative coordinate are 0
						x = 0;
						y = 0;
					}

					ctx.fillText(textValue, x, y);
					console.log("[" + x + "," + y + ":" + rads + "|" + ctx.font + "] " + textValue);
				}

				//Reset transform
				ctx.resetTransform();
			});
		}
	}
	catch (error) {
		console.error(error);
	}
	finally {
		ctx.restore();
		fitDestinationElement(scale)
	}
}

function fitDestinationElement(scale) {
	var newLeftPosition = '';
	var newTopPosition = '';
	$('canvas').each(function() {
		let canvas = $(this)[0];
		let canvasLeft = canvas.width;
		let canvasTop = canvas.height;
		canvas.style.transform = "scale("
		+ scale
		+ ","
		+ scale
		+ ")"

		if(scale < 1) {
			newLeftPosition = (canvasLeft / 2 * -1 * scale).toString() + "px";
			newTopPosition = (canvasTop / 2 * -1 * scale).toString() + "px";
		}
		else {
			newLeftPosition = (canvasLeft / 2 * scale).toString() + "px";
			newTopPosition = (canvasTop / 2 * scale).toString() + "px";
		}		

		let element = document.getElementById(canvas.id);
		element.style.left = newLeftPosition;
		element.style.top = newTopPosition;
//		element.style.position = "absolute";
	});
}

/**
* [checkForReplacement: Check if value must be replaced]
* @param  {[string]} token [ZPL token]
* @param  {[Dictionnary]} replacementValues [Dictionnary<string,string>]
* @return {[string]} [canvasId]
*/
function checkForReplacement(token, replacementValues) {
	let trimmedToken = token.trim();
	if(replacementValues != null && trimmedToken in replacementValues)
	return replacementValues[trimmedToken];
	else
	return token;
}

/**
* [clearLayers: Clear all layers]
*/
function clearLayers() {
	var i;
	for (i = 0; i < 10; i++) {
		$("#layer" + i).remove();
	}
}

/**
* [createNewLayer: Create a new layer with next z index]
* @param  {[int]} currentLayer [Layer index (z index)]
* @return {[string]} [canvasId]
*/
function createNewLayer(currentLayer) {
	var layer = currentLayer + 1;
	var canvasId = 'layer' + layer;
	var canvas = document.createElement('canvas');
	var div = document.getElementById('drawingArea');

	canvas.id = canvasId;
	//Copy main canvas
	canvas.width = c.width;
	canvas.height = c.height;
	canvas.style.position = c.style.position;
	canvas.style.left = c.style.left;
	canvas.style.top = c.style.top;
	canvas.style.zIndex = layer;

	div.appendChild(canvas)

	return canvasId;
}

/**
* [containsBarCodeDefinition: True if commandline contains barcode definition]
* @param  {[string]} commandLine [ZPL code]
* @return {[bool]} [result]
*/
function containsBarCodeDefinition(commandLine) {
	//Should match ^BCo,h,f,g,e,m
	const regex = /\^B[^Y]([A0-Z9,]{6,})\^/;
	let results = regex.exec(commandLine);
	return (results != null);
}

/**
* [buildBarCodeOptions: Build barcode from position and parameters]
* @param  {[string]} commandLine [ZPL code]
* @param  {[string]} type [barcode type]
* @param  {[int]} x [x position]
* @param  {[int]} y [y position]
* @param  {[bool]} HRI [Human readable text]
* @param  {[string]} textValue [Text value]
* @return {[object]} [options]
*/
function buildBarCodeOptions(commandLine, type, x, y, HRI, textValue) {
	//Should match ^B.o,h,f,g,e,m
	const regex = /\^B[^Y]([A0-Z9,]{6,})\^/;
	let results = regex.exec(commandLine);
	//Second result is position
	if(results != null){
		let barcodeParameters = results[1].split(',');
		if(barcodeParameters.length >= 5) {

			if(type == "datamatrix") {
				//Assume encoding is ASCII mode, 1 character = 8 tiles, 2 module height
				let approxCodeSize = 0;

				let orientation = barcodeParameters[0];
				let moduleSize = parseInt(barcodeParameters[1]);
				let eccValue = barcodeParameters[2];
				let printInterpretationLineAboveCode = barcodeParameters[3];
				let uccCheckDigit = barcodeParameters[4];

				if(eccValue == "200")
				{
					//Very naive size, from 9x9 to 49x49
					approxCodeSize = (textValue.length < 9 ? 9 : (textValue.length > 49 ? 49 : textValue.length));
				}
				else
				{
					//Very naive size, from 10x10 to 144x144
					approxCodeSize = (textValue.length < 10 ? 10 : (textValue.length > 144 ? 144 : textValue.length));
				}

				return {output: 'canvas', moduleSize: moduleSize, posX: x, posY: y- (moduleSize * approxCodeSize * 2), showHRI: HRI};
			}
			else
			{
				let orientation = barcodeParameters[0];
				let barCodeHeight = parseInt(barcodeParameters[1]);
				let printInterpretationLine = barcodeParameters[2];
				let printInterpretationLineAboveCode = barcodeParameters[3];
				let uccCheckDigit = barcodeParameters[4];
				return {output: 'canvas', barHeight: barCodeHeight, posX: x, posY: y, showHRI: HRI};
			}
		}
		else
		return {};
	}
	else
	//Not found
	return {};
}

/**
* [getRotationFromCode: Get rotation from code]
* @param  {[string]} property [ZPL code]
* @return {[string]} [rads]
*/
function getRotationFromCode(property) {
	//"A@N,23,22,TT0003M_"
	let angle;
	switch (property[2]) {
		case "N":
		angle = 0;
		break;
		case "R":
		angle = 90;
		break;
		case "I":
		angle = 180;
		break;
		case "B":
		angle = 270;
		break;
		default:
		angle = 0;
		break;
	}
	return (Math.PI / 180) * angle;
}

/**
* [drawBox: Draw box according to ZPL parameters]
* @param  {[string]} position [position string]
* @param  {[string]} parameters [parameters string, separated with coma]
* @param  {[object]} ctx [canvas context]
*/
function drawBox(position, parameters, ctx) {
	//parameter = 0,347,7
	//Default values
	var width, height, thickness = 1;
	var color = 'B';
	var cornerRounding = 0;
	var x, y = 0;

	var splitted = parameters.split(',');

	for (var i in splitted) {
		switch (i) {
			case '0':
			width = parseInt(splitted[i]);
			break;

			case '1':
			height = parseInt(splitted[i]);
			break;

			case '2':
			thickness = parseInt(splitted[i]);
			break;

			case '3':
			color = splitted[i];
			break;

			case '4':
			cornerRounding = parseInt(splitted[i]);
			break;

			default:
			break;
		}
	}

	x = parseInt(position[0]);
	y = parseInt(position[1]);
	ctx.lineWidth = thickness;
	ctx.strokeStyle = "black";
	ctx.rect(x, y, width, height);
	ctx.stroke();
}

/**
* [getBarcodeTypeFromCode: Get barcode type from ZPL code]
* @param  {[string]} code [ZPL code]
* @return {[string]} [barcode type]
*/
function getBarcodeTypeFromCode(commandLine) {
	const regex = /\^B([^Y])/;
	let results = regex.exec(commandLine);
	if(results != null) {
		switch (results[1]) {
			case 'A':
			return 'code93';
			break;
			case 'B':
			case 'R':
			case 'C':
			return 'code128';
			break;
			case '1':
			return 'code11';
			break;
			case '2':
			return 'int25';
			break;
			case '3':
			return 'code39';
			break;
			case '4':
			return 'code49';
			break;
			case '8':
			return 'ean8';
			break;
			case '9':
			case '5':
			case '6':
			case '7':
			return 'code128';
			break;
			case 'Y':
			//Not a barcode
			return '';
			break;

			case 'X':
			//Not a barcode
			return 'datamatrix';
			break;

			default:
			return 'code128';
			break;
		}
	}
	else
	return '';
}

/**
* [getFontFromCode: Get font type from ZPL code]
* @param  {[string]} code [ZPL code]
* @return {[string]} [font type]
*/
function getFontFromCode(code) {
	let fontName = 'Courrier Sans MS'
	let fontSize = 'px'

	properties = code.split(',');
	let fontCode = properties[0].substring(0, 2);

	switch (fontCode) {
		case 'A0':
		fontName = 'Courrier Sans MS'
		break;

		default:
		break;
	}

	if (parseInt(properties[1]) <= 60)
	fontSize = properties[1] + fontSize;
	else
	//Limit
	fontSize = '24px';

	return fontSize + ' ' + fontName;
}

/**
* [getTextValueFronProperties: Get text value from ZPL properties]
* @param  {[string]} properties [ZPL code]
* @return {[string]} [text value]
*/
function getTextValueFronProperties(properties) {
	var textValue = ""
	properties.forEach(function (property) {
		if (property.indexOf('FD') >= 0) {
			textValue = property.replace('FD', '');
		}
	});

	return textValue;
}
